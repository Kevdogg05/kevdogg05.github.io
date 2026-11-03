// Unit tests for include/drive.h. Run on the host:
//   pio test -e native          (real Unity, via PlatformIO)
//   make test                   (from telepresence-bot/, plain g++ + scripts/host-unity)
#include <unity.h>

#include "drive.h"

using namespace telebot;

void setUp() {}
void tearDown() {}

static void test_pct_to_duty_scales_and_clamps() {
  TEST_ASSERT_EQUAL_INT(255, pctToDuty(100, 100));
  TEST_ASSERT_EQUAL_INT(-255, pctToDuty(-100, 100));
  TEST_ASSERT_EQUAL_INT(127, pctToDuty(50, 100));
  TEST_ASSERT_EQUAL_INT(127, pctToDuty(100, 50));
  TEST_ASSERT_EQUAL_INT(0, pctToDuty(100, 0));
  TEST_ASSERT_EQUAL_INT(255, pctToDuty(400, 100));  // input clamped
  TEST_ASSERT_EQUAL_INT(255, pctToDuty(100, 250));  // limit clamped
}

static void test_arcade_straight_and_spin() {
  WheelDuty fwd = mixArcade(0, 100, 100);
  TEST_ASSERT_EQUAL_INT(255, fwd.left);
  TEST_ASSERT_EQUAL_INT(255, fwd.right);

  WheelDuty back = mixArcade(0, -100, 100);
  TEST_ASSERT_EQUAL_INT(-255, back.left);
  TEST_ASSERT_EQUAL_INT(-255, back.right);

  WheelDuty spinRight = mixArcade(100, 0, 100);
  TEST_ASSERT_EQUAL_INT(255, spinRight.left);
  TEST_ASSERT_EQUAL_INT(-255, spinRight.right);

  WheelDuty idle = mixArcade(0, 0, 100);
  TEST_ASSERT_EQUAL_INT(0, idle.left);
  TEST_ASSERT_EQUAL_INT(0, idle.right);
}

static void test_arcade_saturation_keeps_ratio() {
  // Full forward + half right: raw mix is 150 / 50; scaled to 100 / 33.
  WheelDuty arc = mixArcade(50, 100, 100);
  TEST_ASSERT_EQUAL_INT(255, arc.left);
  TEST_ASSERT_EQUAL_INT(84, arc.right);  // 33 % of 255
  TEST_ASSERT_TRUE(arc.left > arc.right);

  // The speed limit scales both wheels.
  WheelDuty slow = mixArcade(0, 100, 40);
  TEST_ASSERT_EQUAL_INT(102, slow.left);
  TEST_ASSERT_EQUAL_INT(102, slow.right);
}

static void test_motion_duty() {
  WheelDuty f = motionDuty(Motion::Forward, 100, 60);
  TEST_ASSERT_EQUAL_INT(255, f.left);
  TEST_ASSERT_EQUAL_INT(255, f.right);

  WheelDuty r = motionDuty(Motion::Reverse, 50, 60);
  TEST_ASSERT_EQUAL_INT(-127, r.left);
  TEST_ASSERT_EQUAL_INT(-127, r.right);

  WheelDuty sl = motionDuty(Motion::SpinLeft, 100, 60);
  TEST_ASSERT_EQUAL_INT(-153, sl.left);
  TEST_ASSERT_EQUAL_INT(153, sl.right);

  WheelDuty sr = motionDuty(Motion::SpinRight, 100, 60);
  TEST_ASSERT_EQUAL_INT(153, sr.left);
  TEST_ASSERT_EQUAL_INT(-153, sr.right);

  WheelDuty s = motionDuty(Motion::Stop, 100, 60);
  TEST_ASSERT_EQUAL_INT(0, s.left);
  TEST_ASSERT_EQUAL_INT(0, s.right);
}

static void test_slew_accelerates_gradually() {
  TEST_ASSERT_EQUAL_INT(12, slewToward(0, 255, 12, 40));
  TEST_ASSERT_EQUAL_INT(255, slewToward(250, 255, 12, 40));  // never overshoots
  TEST_ASSERT_EQUAL_INT(-12, slewToward(0, -255, 12, 40));
  TEST_ASSERT_EQUAL_INT(100, slewToward(100, 100, 12, 40));

  int16_t d = 0;
  int ticks = 0;
  while (d != 255 && ticks < 100) {
    d = slewToward(d, 255, 12, 40);
    ++ticks;
  }
  TEST_ASSERT_EQUAL_INT(22, ticks);  // ~220 ms at 100 Hz
}

static void test_slew_decelerates_fast_and_reverses_through_zero() {
  TEST_ASSERT_EQUAL_INT(215, slewToward(255, 0, 12, 40));
  TEST_ASSERT_EQUAL_INT(0, slewToward(30, 0, 12, 40));
  TEST_ASSERT_EQUAL_INT(-215, slewToward(-255, 0, 12, 40));

  // Reversal: decelerate at the fast rate, stop at zero, then accelerate.
  TEST_ASSERT_EQUAL_INT(215, slewToward(255, -255, 12, 40));
  TEST_ASSERT_EQUAL_INT(0, slewToward(20, -255, 12, 40));
  TEST_ASSERT_EQUAL_INT(-12, slewToward(0, -255, 12, 40));

  // Lowering speed without reversing uses the fast rate but stops at target.
  TEST_ASSERT_EQUAL_INT(150, slewToward(170, 150, 12, 40));
}

static void test_trim_and_min_duty() {
  TEST_ASSERT_EQUAL_INT(229, applyTrim(255, 90));
  TEST_ASSERT_EQUAL_INT(-229, applyTrim(-255, 90));
  TEST_ASSERT_EQUAL_INT(255, applyTrim(255, 150));  // trim clamped to 100 %

  TEST_ASSERT_EQUAL_INT(0, applyMinDuty(0, 85));
  TEST_ASSERT_EQUAL_INT(85, applyMinDuty(1, 85));
  TEST_ASSERT_EQUAL_INT(-85, applyMinDuty(-1, 85));
  TEST_ASSERT_EQUAL_INT(255, applyMinDuty(255, 85));
  TEST_ASSERT_EQUAL_INT(170, applyMinDuty(128, 85));
}

static void test_bridge_inputs() {
  BridgeDuty coast = bridgeInputs(0, true);
  TEST_ASSERT_EQUAL_UINT8(0, coast.in1);
  TEST_ASSERT_EQUAL_UINT8(0, coast.in2);

  // Slow decay: one input high, the other PWMs the inverse duty.
  BridgeDuty slowFwd = bridgeInputs(200, true);
  TEST_ASSERT_EQUAL_UINT8(255, slowFwd.in1);
  TEST_ASSERT_EQUAL_UINT8(55, slowFwd.in2);
  BridgeDuty slowRev = bridgeInputs(-200, true);
  TEST_ASSERT_EQUAL_UINT8(55, slowRev.in1);
  TEST_ASSERT_EQUAL_UINT8(255, slowRev.in2);
  BridgeDuty full = bridgeInputs(255, true);
  TEST_ASSERT_EQUAL_UINT8(255, full.in1);
  TEST_ASSERT_EQUAL_UINT8(0, full.in2);

  // Fast decay: PWM on one input, the other held low.
  BridgeDuty fastFwd = bridgeInputs(200, false);
  TEST_ASSERT_EQUAL_UINT8(200, fastFwd.in1);
  TEST_ASSERT_EQUAL_UINT8(0, fastFwd.in2);
  BridgeDuty fastRev = bridgeInputs(-200, false);
  TEST_ASSERT_EQUAL_UINT8(0, fastRev.in1);
  TEST_ASSERT_EQUAL_UINT8(200, fastRev.in2);
}

static bool parse(const char* s, Command& c) { return parseCommand(s, strlen(s), c); }

static void test_parse_drive_commands() {
  Command c;
  TEST_ASSERT_TRUE(parse("joy -40 75", c));
  TEST_ASSERT_TRUE(c.type == CmdType::Joy);
  TEST_ASSERT_EQUAL_INT(-40, c.a);
  TEST_ASSERT_EQUAL_INT(75, c.b);

  TEST_ASSERT_TRUE(parse("tank 100 -100", c));
  TEST_ASSERT_TRUE(c.type == CmdType::Tank);
  TEST_ASSERT_EQUAL_INT(100, c.a);
  TEST_ASSERT_EQUAL_INT(-100, c.b);

  TEST_ASSERT_TRUE(parse("move forward", c));
  TEST_ASSERT_TRUE(c.type == CmdType::Move && c.motion == Motion::Forward);
  TEST_ASSERT_TRUE(parse("move reverse", c));
  TEST_ASSERT_TRUE(c.motion == Motion::Reverse);
  TEST_ASSERT_TRUE(parse("move left", c));
  TEST_ASSERT_TRUE(c.motion == Motion::SpinLeft);
  TEST_ASSERT_TRUE(parse("move right", c));
  TEST_ASSERT_TRUE(c.motion == Motion::SpinRight);
  TEST_ASSERT_TRUE(parse("move stop", c));
  TEST_ASSERT_TRUE(c.motion == Motion::Stop);

  TEST_ASSERT_TRUE(parse("stop", c));
  TEST_ASSERT_TRUE(c.type == CmdType::Stop);

  TEST_ASSERT_TRUE(parse("  joy\t1   2 \r\n", c));  // whitespace tolerant
  TEST_ASSERT_EQUAL_INT(1, c.a);
  TEST_ASSERT_EQUAL_INT(2, c.b);
}

static void test_parse_settings_and_ping() {
  Command c;
  TEST_ASSERT_TRUE(parse("speed 65", c));
  TEST_ASSERT_TRUE(c.type == CmdType::Speed);
  TEST_ASSERT_EQUAL_INT(65, c.a);

  TEST_ASSERT_TRUE(parse("light 0", c));
  TEST_ASSERT_TRUE(c.type == CmdType::Light);
  TEST_ASSERT_EQUAL_INT(0, c.a);

  TEST_ASSERT_TRUE(parse("ping 4000000000", c));
  TEST_ASSERT_TRUE(c.type == CmdType::Ping);
  TEST_ASSERT_EQUAL_UINT32(4000000000u, c.token);

  TEST_ASSERT_TRUE(parse("cam framesize vga", c));
  TEST_ASSERT_TRUE(c.type == CmdType::Cam);
  TEST_ASSERT_EQUAL_STRING("framesize", c.key);
  TEST_ASSERT_EQUAL_STRING("vga", c.arg);
}

static void test_parse_rejects_bad_input() {
  Command c;
  const char* bad[] = {
      "",          "   ",          "fly 1 2",       "joy",           "joy 1",        "joy 1 2 3",
      "joy a b",   "joy 1.5 2",    "tank 1",        "move",          "move sideways", "stop now",
      "speed",     "speed 101",    "speed -1",      "light 1000",    "ping",         "ping -5",
      "ping abc",  "cam vflip",    "cam averyveryverylongkey 1",     "JOY 1 2",
  };
  for (const char* s : bad) {
    TEST_ASSERT_FALSE(parse(s, c));
    TEST_ASSERT_TRUE(c.type == CmdType::Invalid);
  }

  char longMsg[128];
  memset(longMsg, ' ', sizeof(longMsg));
  memcpy(longMsg, "stop", 4);
  TEST_ASSERT_FALSE(parseCommand(longMsg, sizeof(longMsg), c));  // over kMaxCommandLen
  TEST_ASSERT_FALSE(parseCommand(nullptr, 4, c));

  // Not NUL-terminated: only `len` bytes are read.
  const char raw[] = {'s', 't', 'o', 'p', 'X'};
  TEST_ASSERT_TRUE(parseCommand(raw, 4, c));
  TEST_ASSERT_TRUE(c.type == CmdType::Stop);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_pct_to_duty_scales_and_clamps);
  RUN_TEST(test_arcade_straight_and_spin);
  RUN_TEST(test_arcade_saturation_keeps_ratio);
  RUN_TEST(test_motion_duty);
  RUN_TEST(test_slew_accelerates_gradually);
  RUN_TEST(test_slew_decelerates_fast_and_reverses_through_zero);
  RUN_TEST(test_trim_and_min_duty);
  RUN_TEST(test_bridge_inputs);
  RUN_TEST(test_parse_drive_commands);
  RUN_TEST(test_parse_settings_and_ping);
  RUN_TEST(test_parse_rejects_bad_input);
  return UNITY_END();
}
