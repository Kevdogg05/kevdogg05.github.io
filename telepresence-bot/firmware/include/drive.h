// drive.h: hardware-free drive logic and the control-protocol parser.
//
// Everything here is plain C++ with no Arduino or ESP-IDF headers, so the same
// code runs on the robot and in the native unit tests (`pio test -e native`).
//
// Units
//   percent  -100..100   what clients send (joystick axes, tank sticks)
//   duty     -255..255   signed PWM duty for one wheel, + is forward
#pragma once

#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

namespace telebot {

constexpr int16_t kDutyMax = 255;

struct WheelDuty {
  int16_t left;
  int16_t right;
};

inline bool operator==(const WheelDuty& a, const WheelDuty& b) {
  return a.left == b.left && a.right == b.right;
}

enum class Motion : uint8_t { Stop, Forward, Reverse, SpinLeft, SpinRight };

inline int clampInt(int v, int lo, int hi) { return v < lo ? lo : (v > hi ? hi : v); }

// Percent (-100..100) to duty, scaled by a 0..100 % speed limit.
inline int16_t pctToDuty(int pct, int limitPct) {
  pct = clampInt(pct, -100, 100);
  limitPct = clampInt(limitPct, 0, 100);
  return static_cast<int16_t>(static_cast<long>(pct) * limitPct * kDutyMax / 10000);
}

// Arcade (single joystick) mix. x is right-positive, y is forward-positive.
// When a wheel would exceed 100 % both wheels are scaled down together, so
// the turn radius the driver asked for is kept instead of clipped.
inline WheelDuty mixArcade(int x, int y, int limitPct) {
  x = clampInt(x, -100, 100);
  y = clampInt(y, -100, 100);
  int l = y + x;
  int r = y - x;
  const int peak = abs(l) > abs(r) ? abs(l) : abs(r);
  if (peak > 100) {
    l = l * 100 / peak;
    r = r * 100 / peak;
  }
  return {pctToDuty(l, limitPct), pctToDuty(r, limitPct)};
}

// Tank mix: each stick drives one wheel directly.
inline WheelDuty tankDrive(int leftPct, int rightPct, int limitPct) {
  return {pctToDuty(leftPct, limitPct), pctToDuty(rightPct, limitPct)};
}

// Discrete D-pad motions. Spins run at spinScalePct of the speed limit,
// because a full-speed pivot smears the camera image.
inline WheelDuty motionDuty(Motion m, int speedPct, int spinScalePct) {
  const int16_t d = pctToDuty(100, speedPct);
  const int16_t s = pctToDuty(clampInt(spinScalePct, 0, 100), speedPct);
  switch (m) {
    case Motion::Forward:   return {d, d};
    case Motion::Reverse:   return {static_cast<int16_t>(-d), static_cast<int16_t>(-d)};
    case Motion::SpinLeft:  return {static_cast<int16_t>(-s), s};
    case Motion::SpinRight: return {s, static_cast<int16_t>(-s)};
    case Motion::Stop:
    default:                return {0, 0};
  }
}

// Ramp limiter, called once per control tick. Speeding up moves at most
// `up` per tick (limits inrush current, which browns out the ESP32-CAM);
// slowing down moves at most `down` per tick. A reversal first decelerates
// to zero, then accelerates the other way.
inline int16_t slewToward(int16_t cur, int16_t tgt, int16_t up, int16_t down) {
  if (cur == tgt) return cur;
  const bool sameSide = (cur >= 0 && tgt >= 0) || (cur <= 0 && tgt <= 0);
  if (sameSide && abs(tgt) > abs(cur)) {
    const int next = tgt > cur ? cur + up : cur - up;
    return static_cast<int16_t>(tgt > cur ? (next > tgt ? tgt : next) : (next < tgt ? tgt : next));
  }
  const int goal = sameSide ? tgt : 0;
  const int next = goal > cur ? cur + down : cur - down;
  return static_cast<int16_t>(goal > cur ? (next > goal ? goal : next) : (next < goal ? goal : next));
}

// Per-wheel trim (0..100 %) to correct a robot that drifts to one side.
inline int16_t applyTrim(int16_t duty, int trimPct) {
  return static_cast<int16_t>(static_cast<long>(duty) * clampInt(trimPct, 0, 100) / 100);
}

// TT gear motors do not turn below roughly a third of full duty. Map any
// non-zero command into [minDuty, 255] so the bottom of the stick still moves.
inline int16_t applyMinDuty(int16_t duty, int minDuty) {
  if (duty == 0) return 0;
  minDuty = clampInt(minDuty, 0, kDutyMax - 1);
  const int mag = clampInt(abs(duty), 0, kDutyMax);
  const int out = minDuty + static_cast<long>(mag) * (kDutyMax - minDuty) / kDutyMax;
  return static_cast<int16_t>(duty > 0 ? out : -out);
}

// H-bridge input duties for one motor (DRV8833 xIN1/xIN2, or L298N INx with
// the ENx jumper fitted). Slow decay drives on one input and PWMs the other,
// alternating drive and brake: better low-speed torque and a more linear
// response. Fast decay PWMs one input and holds the other low (drive/coast).
// Zero duty coasts with both inputs low.
struct BridgeDuty {
  uint8_t in1;
  uint8_t in2;
};

inline BridgeDuty bridgeInputs(int16_t duty, bool slowDecay) {
  const int mag = clampInt(abs(duty), 0, kDutyMax);
  if (mag == 0) return {0, 0};
  const uint8_t on = static_cast<uint8_t>(mag);
  const uint8_t off = static_cast<uint8_t>(kDutyMax - mag);
  if (slowDecay) {
    return duty > 0 ? BridgeDuty{255, off} : BridgeDuty{off, 255};
  }
  return duty > 0 ? BridgeDuty{on, 0} : BridgeDuty{0, on};
}

// ---------------------------------------------------------------------------
// Control protocol (WebSocket text frames, one command per frame)
//
//   joy <x> <y>              arcade drive, -100..100 each (y forward)
//   tank <left> <right>      per-wheel drive, -100..100 each
//   move <forward|reverse|left|right|stop>
//   stop                     stop now
//   speed <0..100>           speed limit for every drive command
//   light <0..100>           flash LED brightness
//   ping <token>             robot answers {"type":"pong","t":<token>}
//   cam <key> <value>        camera setting, e.g. "cam framesize vga"
//
// Drive commands must repeat (clients send ~10-20 per second while a control
// is held); the robot stops when they stop arriving.
// ---------------------------------------------------------------------------

enum class CmdType : uint8_t { Invalid, Joy, Tank, Move, Stop, Speed, Light, Ping, Cam };

struct Command {
  CmdType type = CmdType::Invalid;
  int a = 0;
  int b = 0;
  Motion motion = Motion::Stop;
  uint32_t token = 0;
  char key[16] = {0};
  char arg[16] = {0};
};

constexpr size_t kMaxCommandLen = 63;

inline bool parseIntStrict(const char* s, int& out) {
  if (s == nullptr || *s == '\0') return false;
  char* end = nullptr;
  const long v = strtol(s, &end, 10);
  if (end == s || *end != '\0' || v < -1000000L || v > 1000000L) return false;
  out = static_cast<int>(v);
  return true;
}

inline bool parseU32Strict(const char* s, uint32_t& out) {
  if (s == nullptr || *s < '0' || *s > '9') return false;
  char* end = nullptr;
  const unsigned long v = strtoul(s, &end, 10);
  if (*end != '\0' || v > 0xFFFFFFFFUL) return false;
  out = static_cast<uint32_t>(v);
  return true;
}

inline bool parseMotion(const char* s, Motion& out) {
  struct Name { const char* name; Motion motion; };
  static const Name kNames[] = {
      {"forward", Motion::Forward}, {"reverse", Motion::Reverse}, {"left", Motion::SpinLeft},
      {"right", Motion::SpinRight}, {"stop", Motion::Stop},
  };
  for (const Name& n : kNames) {
    if (strcmp(s, n.name) == 0) {
      out = n.motion;
      return true;
    }
  }
  return false;
}

// Parses one frame. `msg` need not be NUL-terminated. Returns false (and
// leaves out.type == Invalid) for anything malformed.
inline bool parseCommand(const char* msg, size_t len, Command& out) {
  out = Command{};
  if (msg == nullptr || len == 0 || len > kMaxCommandLen) return false;

  char buf[kMaxCommandLen + 1];
  memcpy(buf, msg, len);
  buf[len] = '\0';

  // Split on spaces into at most 3 tokens; a 4th token is an error.
  char* tok[3] = {nullptr, nullptr, nullptr};
  int n = 0;
  for (char* p = buf; *p != '\0';) {
    while (*p == ' ' || *p == '\t' || *p == '\r' || *p == '\n') *p++ = '\0';
    if (*p == '\0') break;
    if (n == 3) return false;
    tok[n++] = p;
    while (*p != '\0' && *p != ' ' && *p != '\t' && *p != '\r' && *p != '\n') ++p;
  }
  if (n == 0) return false;

  const char* verb = tok[0];
  Command c;
  if (strcmp(verb, "joy") == 0 || strcmp(verb, "tank") == 0) {
    if (n != 3 || !parseIntStrict(tok[1], c.a) || !parseIntStrict(tok[2], c.b)) return false;
    c.type = verb[0] == 'j' ? CmdType::Joy : CmdType::Tank;
  } else if (strcmp(verb, "move") == 0) {
    if (n != 2 || !parseMotion(tok[1], c.motion)) return false;
    c.type = CmdType::Move;
  } else if (strcmp(verb, "stop") == 0) {
    if (n != 1) return false;
    c.type = CmdType::Stop;
  } else if (strcmp(verb, "speed") == 0 || strcmp(verb, "light") == 0) {
    if (n != 2 || !parseIntStrict(tok[1], c.a) || c.a < 0 || c.a > 100) return false;
    c.type = verb[0] == 's' ? CmdType::Speed : CmdType::Light;
  } else if (strcmp(verb, "ping") == 0) {
    if (n != 2 || !parseU32Strict(tok[1], c.token)) return false;
    c.type = CmdType::Ping;
  } else if (strcmp(verb, "cam") == 0) {
    if (n != 3 || strlen(tok[1]) >= sizeof(c.key) || strlen(tok[2]) >= sizeof(c.arg)) return false;
    strcpy(c.key, tok[1]);
    strcpy(c.arg, tok[2]);
    c.type = CmdType::Cam;
  } else {
    return false;
  }
  out = c;
  return true;
}

}  // namespace telebot
