// TeleBot firmware: Wi-Fi telepresence robot on an AI-Thinker ESP32-CAM.
//
//   :80  /         dashboard (web/index.html, gzipped into flash at build time)
//   :80  /ws       WebSocket control channel (protocol in include/drive.h)
//   :80  /status   JSON state, for scripts and health checks
//   :81  /stream   MJPEG video (multipart/x-mixed-replace), one viewer at a time
//   :81  /capture  single JPEG, when no stream is open
//
// Safety: wheels stop when drive commands stop arriving (FAILSAFE_TIMEOUT_MS),
// when the client that was driving disconnects, and during OTA updates.
// Speed changes are ramped to keep motor inrush from browning out the board.

// esp_http_server.h must come before ESPAsyncWebServer.h: the async server
// then reuses ESP-IDF's HTTP method enum instead of redefining HTTP_GET.
#include "esp_http_server.h"

#include <Arduino.h>
#include <ArduinoOTA.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ESPmDNS.h>
#include <Preferences.h>
#include <WiFi.h>

#include <atomic>

#include "esp_camera.h"
#include "esp_timer.h"

#include "config.h"
#include "drive.h"

#if __has_include("secrets.h")
#include "secrets.h"
#endif

#if __has_include("web_index.h")
#include "web_index.h"
#else
#error "web_index.h is missing. It is generated from web/index.html by scripts/embed_web.py: PlatformIO runs it before every build; for arduino-cli run `make embed`."
#endif

#if DISABLE_BROWNOUT_DETECTOR
#include "soc/rtc_cntl_reg.h"
#include "soc/soc.h"
#endif

#ifndef WIFI_STA_SSID
#define WIFI_STA_SSID ""
#endif
#ifndef WIFI_STA_PASS
#define WIFI_STA_PASS ""
#endif
#ifndef WIFI_AP_PASS
#define WIFI_AP_PASS "telebot1234"  // change it in secrets.h
#endif
#ifndef ACCESS_TOKEN
#define ACCESS_TOKEN ""
#endif

static_assert(sizeof(WIFI_AP_PASS) - 1 >= 8, "WIFI_AP_PASS must be at least 8 characters (WPA2)");

#define LOG(fmt, ...) Serial.printf("[telebot] " fmt "\n", ##__VA_ARGS__)

namespace {

using telebot::CmdType;
using telebot::Command;
using telebot::WheelDuty;

constexpr char kAccessToken[] = ACCESS_TOKEN;

AsyncWebServer server(80);
AsyncWebSocket ws("/ws");
httpd_handle_t streamServer = nullptr;
Preferences prefs;

// ---------------------------------------------------------------------------
// Shared state. WebSocket callbacks run on the AsyncTCP task, the ramp and
// PWM run in loop(), the MJPEG stream runs on the httpd task.
// ---------------------------------------------------------------------------
portMUX_TYPE driveMux = portMUX_INITIALIZER_UNLOCKED;
WheelDuty driveTarget = {0, 0};  // guarded by driveMux
uint32_t lastDriveMs = 0;        // guarded by driveMux
uint32_t driverClientId = 0;     // guarded by driveMux

WheelDuty driveOutput = {0, 0};  // loop() only: ramped duty sent to the bridge
bool failsafeTripped = false;    // loop() only: stopped by timeout, not by "stop"

std::atomic<uint8_t> speedPct{DEFAULT_SPEED_PCT};
std::atomic<uint8_t> lightPct{0};
std::atomic<bool> otaActive{false};
std::atomic<bool> streamActive{false};
std::atomic<uint32_t> streamFrames{0};
std::atomic<bool> prefsDirty{false};
std::atomic<uint32_t> prefsDirtyMs{0};

bool cameraOk = false;
bool apMode = false;
framesize_t maxFrameSize = FRAMESIZE_QVGA;
float streamFps = 0.0f;

struct CameraSettings {
  framesize_t frameSize = CAMERA_DEFAULT_FRAMESIZE;
  int quality = CAMERA_DEFAULT_QUALITY;
  int vflip = CAMERA_DEFAULT_VFLIP;
  int hmirror = CAMERA_DEFAULT_HMIRROR;
} cam;

struct FrameSizeName {
  const char* name;
  framesize_t size;
};
constexpr FrameSizeName kFrameSizes[] = {
    {"qvga", FRAMESIZE_QVGA}, {"cif", FRAMESIZE_CIF},   {"hvga", FRAMESIZE_HVGA},
    {"vga", FRAMESIZE_VGA},   {"svga", FRAMESIZE_SVGA},
};

const char* frameSizeName(framesize_t size) {
  for (const auto& f : kFrameSizes) {
    if (f.size == size) return f.name;
  }
  return "other";
}

void markPrefsDirty() {
  prefsDirtyMs = millis();
  prefsDirty = true;
}

// ---------------------------------------------------------------------------
// PWM: Arduino-ESP32 3.x attaches LEDC by pin, 2.x by channel. Channels are
// pinned explicitly in both so nothing lands on the camera's channel 0.
// ---------------------------------------------------------------------------
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
void pwmAttach(uint8_t pin, uint8_t channel, uint32_t freq, uint8_t bits) {
  ledcAttachChannel(pin, freq, bits, channel);
}
void pwmWrite(uint8_t pin, uint8_t, uint32_t duty) { ledcWrite(pin, duty); }
#else
void pwmAttach(uint8_t pin, uint8_t channel, uint32_t freq, uint8_t bits) {
  ledcSetup(channel, freq, bits);
  ledcAttachPin(pin, channel);
}
void pwmWrite(uint8_t, uint8_t channel, uint32_t duty) { ledcWrite(channel, duty); }
#endif

// ---------------------------------------------------------------------------
// Motors
// ---------------------------------------------------------------------------
struct Motor {
  uint8_t pin1, pin2, ch1, ch2;
  bool invert;
  int trimPct;
  int16_t written;  // last duty sent, to skip redundant LEDC writes
};

Motor leftMotor = {PIN_MOTOR_L_IN1, PIN_MOTOR_L_IN2, LEDC_CH_MOTOR_L1, LEDC_CH_MOTOR_L2,
                   MOTOR_LEFT_INVERT != 0, MOTOR_LEFT_TRIM_PCT, INT16_MIN};
Motor rightMotor = {PIN_MOTOR_R_IN1, PIN_MOTOR_R_IN2, LEDC_CH_MOTOR_R1, LEDC_CH_MOTOR_R2,
                    MOTOR_RIGHT_INVERT != 0, MOTOR_RIGHT_TRIM_PCT, INT16_MIN};

void setDriverAwake(bool awake) {
#if PIN_MOTOR_SLEEP >= 0
  digitalWrite(PIN_MOTOR_SLEEP, awake ? HIGH : LOW);
#endif
}

void holdMotorPinsLow() {
#if PIN_MOTOR_SLEEP >= 0
  pinMode(PIN_MOTOR_SLEEP, OUTPUT);
#endif
  setDriverAwake(false);
  for (uint8_t pin : {PIN_MOTOR_L_IN1, PIN_MOTOR_L_IN2, PIN_MOTOR_R_IN1, PIN_MOTOR_R_IN2}) {
    pinMode(pin, OUTPUT);
    digitalWrite(pin, LOW);
  }
}

void initMotors() {
  for (Motor* m : {&leftMotor, &rightMotor}) {
    pwmAttach(m->pin1, m->ch1, MOTOR_PWM_FREQ_HZ, MOTOR_PWM_BITS);
    pwmAttach(m->pin2, m->ch2, MOTOR_PWM_FREQ_HZ, MOTOR_PWM_BITS);
    pwmWrite(m->pin1, m->ch1, 0);
    pwmWrite(m->pin2, m->ch2, 0);
    m->written = 0;
  }
  setDriverAwake(true);  // inputs are now driven low by LEDC: safe to wake the bridge
}

void writeMotor(Motor& m, int16_t duty) {
  if (duty == m.written) return;
  m.written = duty;
  int16_t out = telebot::applyMinDuty(telebot::applyTrim(duty, m.trimPct), MOTOR_MIN_DUTY);
  if (m.invert) out = static_cast<int16_t>(-out);
  const telebot::BridgeDuty in = telebot::bridgeInputs(out, MOTOR_SLOW_DECAY != 0);
  pwmWrite(m.pin1, m.ch1, in.in1);
  pwmWrite(m.pin2, m.ch2, in.in2);
}

void setDriveTarget(WheelDuty target, uint32_t clientId) {
  portENTER_CRITICAL(&driveMux);
  driveTarget = target;
  lastDriveMs = millis();
  driverClientId = clientId;
  portEXIT_CRITICAL(&driveMux);
}

void stopAll() {
  setDriveTarget({0, 0}, 0);
  driveOutput = {0, 0};
  writeMotor(leftMotor, 0);
  writeMotor(rightMotor, 0);
}

// 100 Hz: apply the failsafe, ramp toward the target, update the bridge.
void controlTick() {
  WheelDuty target;
  uint32_t last;
  portENTER_CRITICAL(&driveMux);
  target = driveTarget;
  last = lastDriveMs;
  portEXIT_CRITICAL(&driveMux);

  const bool expired = millis() - last > FAILSAFE_TIMEOUT_MS;
  if (expired && (target.left != 0 || target.right != 0)) failsafeTripped = true;
  if (!expired) failsafeTripped = false;
  if (expired || otaActive) target = {0, 0};

  driveOutput.left = telebot::slewToward(driveOutput.left, target.left, RAMP_UP_PER_TICK, RAMP_DOWN_PER_TICK);
  driveOutput.right = telebot::slewToward(driveOutput.right, target.right, RAMP_UP_PER_TICK, RAMP_DOWN_PER_TICK);
  writeMotor(leftMotor, driveOutput.left);
  writeMotor(rightMotor, driveOutput.right);
}

void setLight(int pct) {
  lightPct = static_cast<uint8_t>(telebot::clampInt(pct, 0, 100));
  pwmWrite(PIN_FLASH_LED, LEDC_CH_LIGHT, static_cast<uint32_t>(lightPct) * LIGHT_MAX_DUTY / 100);
}

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------
bool initCamera() {
  camera_config_t c = {};
  c.ledc_channel = LEDC_CHANNEL_0;
  c.ledc_timer = LEDC_TIMER_0;
  // AI-Thinker ESP32-CAM pin map (same as Espressif's CameraWebServer example)
  c.pin_d0 = 5;
  c.pin_d1 = 18;
  c.pin_d2 = 19;
  c.pin_d3 = 21;
  c.pin_d4 = 36;
  c.pin_d5 = 39;
  c.pin_d6 = 34;
  c.pin_d7 = 35;
  c.pin_xclk = 0;
  c.pin_pclk = 22;
  c.pin_vsync = 25;
  c.pin_href = 23;
  c.pin_sccb_sda = 26;
  c.pin_sccb_scl = 27;
  c.pin_pwdn = 32;
  c.pin_reset = -1;
  c.xclk_freq_hz = CAMERA_XCLK_HZ;
  c.pixel_format = PIXFORMAT_JPEG;

  if (psramFound()) {
    // Buffers are sized for the largest frame the dashboard offers, so the
    // size can change at runtime. Two buffers + GRAB_LATEST = freshest frame.
    maxFrameSize = FRAMESIZE_SVGA;
    c.frame_size = maxFrameSize;
    c.jpeg_quality = 10;
    c.fb_count = 2;
    c.fb_location = CAMERA_FB_IN_PSRAM;
    c.grab_mode = CAMERA_GRAB_LATEST;
  } else {
    LOG("no PSRAM: video limited to QVGA");
    maxFrameSize = FRAMESIZE_QVGA;
    c.frame_size = maxFrameSize;
    c.jpeg_quality = 12;
    c.fb_count = 1;
    c.fb_location = CAMERA_FB_IN_DRAM;
    c.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  }

  esp_err_t err = esp_camera_init(&c);
  if (err != ESP_OK) {
    // A cold boot on a sagging supply sometimes misses the sensor probe.
    LOG("camera init failed (0x%x), retrying", err);
    delay(300);
    err = esp_camera_init(&c);
  }
  if (err != ESP_OK) {
    LOG("camera init failed (0x%x): check the ribbon cable and the 5 V supply", err);
    return false;
  }

  if (cam.frameSize > maxFrameSize) cam.frameSize = maxFrameSize;
  sensor_t* s = esp_camera_sensor_get();
  s->set_framesize(s, cam.frameSize);
  s->set_quality(s, cam.quality);
  s->set_vflip(s, cam.vflip);
  s->set_hmirror(s, cam.hmirror);
  LOG("camera ready: sensor PID 0x%x, %s, quality %d", s->id.PID, frameSizeName(cam.frameSize), cam.quality);
  return true;
}

// Applies one "cam <key> <value>" setting. Returns false if rejected.
bool applyCameraSetting(const char* key, const char* value) {
  sensor_t* s = cameraOk ? esp_camera_sensor_get() : nullptr;
  if (s == nullptr) return false;
  int v = 0;
  if (strcmp(key, "framesize") == 0) {
    for (const auto& f : kFrameSizes) {
      if (strcmp(value, f.name) == 0) {
        if (f.size > maxFrameSize || s->set_framesize(s, f.size) != 0) return false;
        cam.frameSize = f.size;
        markPrefsDirty();
        return true;
      }
    }
    return false;
  }
  if (!telebot::parseIntStrict(value, v)) return false;
  if (strcmp(key, "quality") == 0) {
    v = telebot::clampInt(v, 10, 63);
    if (s->set_quality(s, v) != 0) return false;
    cam.quality = v;
  } else if (strcmp(key, "vflip") == 0) {
    v = v ? 1 : 0;
    if (s->set_vflip(s, v) != 0) return false;
    cam.vflip = v;
  } else if (strcmp(key, "hmirror") == 0) {
    v = v ? 1 : 0;
    if (s->set_hmirror(s, v) != 0) return false;
    cam.hmirror = v;
  } else if (strcmp(key, "brightness") == 0) {
    return s->set_brightness(s, telebot::clampInt(v, -2, 2)) == 0;  // not persisted
  } else {
    return false;
  }
  markPrefsDirty();
  return true;
}

// ---------------------------------------------------------------------------
// MJPEG stream server (ESP-IDF httpd on port 81, its own task). Kept apart
// from the async server so a large frame never delays a control message.
// ---------------------------------------------------------------------------
#define PART_BOUNDARY "telebotframe"
constexpr char kStreamContentType[] = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
constexpr char kStreamBoundary[] = "\r\n--" PART_BOUNDARY "\r\n";
constexpr char kStreamPart[] = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

bool tokenMatches(const char* given) { return kAccessToken[0] == '\0' || strcmp(given, kAccessToken) == 0; }

bool httpdTokenOk(httpd_req_t* req) {
  if (kAccessToken[0] == '\0') return true;
  char query[128];
  char token[64];
  if (httpd_req_get_url_query_str(req, query, sizeof(query)) != ESP_OK) return false;
  if (httpd_query_key_value(query, "token", token, sizeof(token)) != ESP_OK) return false;
  return tokenMatches(token);
}

esp_err_t sendHttpdError(httpd_req_t* req, const char* status, const char* message) {
  httpd_resp_set_status(req, status);
  httpd_resp_set_type(req, "text/plain");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  return httpd_resp_send(req, message, HTTPD_RESP_USE_STRLEN);
}

esp_err_t streamHandler(httpd_req_t* req) {
  if (!httpdTokenOk(req)) return sendHttpdError(req, "401 Unauthorized", "token required");
  if (!cameraOk) return sendHttpdError(req, "503 Service Unavailable", "camera not available");

  httpd_resp_set_type(req, kStreamContentType);
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Cache-Control", "no-store");

  streamActive = true;
  LOG("stream started");
  char part[64];
  const int64_t minFrameUs = 1000000LL / STREAM_MAX_FPS;
  int64_t lastFrameUs = 0;
  esp_err_t res = ESP_OK;

  while (res == ESP_OK && !otaActive) {
    const int64_t waitUs = minFrameUs - (esp_timer_get_time() - lastFrameUs);
    if (waitUs > 1000) vTaskDelay(pdMS_TO_TICKS(waitUs / 1000));

    camera_fb_t* fb = esp_camera_fb_get();
    if (fb == nullptr) {
      LOG("frame capture failed");
      res = ESP_FAIL;
      break;
    }
    lastFrameUs = esp_timer_get_time();
    const int partLen = snprintf(part, sizeof(part), kStreamPart, static_cast<unsigned>(fb->len));
    res = httpd_resp_send_chunk(req, kStreamBoundary, sizeof(kStreamBoundary) - 1);
    if (res == ESP_OK) res = httpd_resp_send_chunk(req, part, partLen);
    if (res == ESP_OK) res = httpd_resp_send_chunk(req, reinterpret_cast<const char*>(fb->buf), fb->len);
    esp_camera_fb_return(fb);
    if (res == ESP_OK) ++streamFrames;
  }

  streamActive = false;
  LOG("stream ended");
  return res;
}

esp_err_t captureHandler(httpd_req_t* req) {
  if (!httpdTokenOk(req)) return sendHttpdError(req, "401 Unauthorized", "token required");
  if (!cameraOk) return sendHttpdError(req, "503 Service Unavailable", "camera not available");
  camera_fb_t* fb = esp_camera_fb_get();
  if (fb == nullptr) return sendHttpdError(req, "500 Internal Server Error", "capture failed");
  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Content-Disposition", "inline; filename=telebot.jpg");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  const esp_err_t res = httpd_resp_send(req, reinterpret_cast<const char*>(fb->buf), fb->len);
  esp_camera_fb_return(fb);
  return res;
}

void startStreamServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = STREAM_PORT;
  config.ctrl_port = STREAM_PORT + 32768;
  config.max_uri_handlers = 4;
  config.max_open_sockets = 4;
  config.lru_purge_enable = true;
  config.stack_size = 6144;
  config.send_wait_timeout = 3;  // seconds: drop a viewer that stops reading

  if (httpd_start(&streamServer, &config) != ESP_OK) {
    LOG("stream server failed to start");
    return;
  }
  // Zero-initialised, then filled in: httpd_uri_t gains WebSocket fields
  // depending on the ESP-IDF build options.
  httpd_uri_t stream = {};
  stream.uri = "/stream";
  stream.method = HTTP_GET;
  stream.handler = streamHandler;
  httpd_uri_t capture = {};
  capture.uri = "/capture";
  capture.method = HTTP_GET;
  capture.handler = captureHandler;
  httpd_register_uri_handler(streamServer, &stream);
  httpd_register_uri_handler(streamServer, &capture);
}

// ---------------------------------------------------------------------------
// JSON messages (built with snprintf: small, fixed shape, no allocation)
// ---------------------------------------------------------------------------
String ipAddress() { return apMode ? WiFi.softAPIP().toString() : WiFi.localIP().toString(); }

size_t writeStateJson(char* out, size_t cap) {
  return snprintf(out, cap,
                  "{\"type\":\"state\",\"name\":\"%s\",\"fw\":\"%s\",\"ip\":\"%s\",\"ap\":%s,"
                  "\"streamPort\":%d,\"tokenRequired\":%s,\"speed\":%u,\"light\":%u,"
                  "\"cam\":{\"ok\":%s,\"framesize\":\"%s\",\"maxFramesize\":\"%s\",\"quality\":%d,"
                  "\"vflip\":%d,\"hmirror\":%d},\"failsafeMs\":%d}",
                  TELEBOT_HOSTNAME, TELEBOT_FW_VERSION, ipAddress().c_str(), apMode ? "true" : "false",
                  STREAM_PORT, kAccessToken[0] ? "true" : "false", static_cast<unsigned>(speedPct.load()),
                  static_cast<unsigned>(lightPct.load()), cameraOk ? "true" : "false",
                  frameSizeName(cam.frameSize), frameSizeName(maxFrameSize), cam.quality, cam.vflip, cam.hmirror,
                  FAILSAFE_TIMEOUT_MS);
}

size_t writeTelemetryJson(char* out, size_t cap) {
  return snprintf(out, cap,
                  "{\"type\":\"telemetry\",\"uptime\":%lu,\"rssi\":%d,\"heap\":%lu,\"psram\":%lu,"
                  "\"fps\":%.1f,\"streaming\":%s,\"left\":%d,\"right\":%d,\"failsafe\":%s,\"clients\":%u}",
                  static_cast<unsigned long>(millis() / 1000), apMode ? 0 : static_cast<int>(WiFi.RSSI()),
                  static_cast<unsigned long>(ESP.getFreeHeap()), static_cast<unsigned long>(ESP.getFreePsram()),
                  streamFps, streamActive ? "true" : "false", driveOutput.left, driveOutput.right,
                  failsafeTripped ? "true" : "false", static_cast<unsigned>(ws.count()));
}

void broadcastState() {
  char json[512];
  writeStateJson(json, sizeof(json));
  ws.textAll(json);
}

// ---------------------------------------------------------------------------
// WebSocket control channel
// ---------------------------------------------------------------------------
void handleMessage(AsyncWebSocketClient* client, const char* msg, size_t len) {
  Command cmd;
  if (!telebot::parseCommand(msg, len, cmd)) {
    client->text("{\"type\":\"error\",\"msg\":\"bad command\"}");
    return;
  }
  switch (cmd.type) {
    case CmdType::Joy:
      setDriveTarget(telebot::mixArcade(cmd.a, cmd.b, speedPct), client->id());
      break;
    case CmdType::Tank:
      setDriveTarget(telebot::tankDrive(cmd.a, cmd.b, speedPct), client->id());
      break;
    case CmdType::Move:
      setDriveTarget(telebot::motionDuty(cmd.motion, speedPct, SPIN_SCALE_PCT), client->id());
      break;
    case CmdType::Stop:
      setDriveTarget({0, 0}, client->id());
      break;
    case CmdType::Speed:
      speedPct = static_cast<uint8_t>(cmd.a);
      markPrefsDirty();
      broadcastState();
      break;
    case CmdType::Light:
      setLight(cmd.a);
      broadcastState();
      break;
    case CmdType::Ping: {
      char pong[48];
      snprintf(pong, sizeof(pong), "{\"type\":\"pong\",\"t\":%lu}", static_cast<unsigned long>(cmd.token));
      client->text(pong);
      break;
    }
    case CmdType::Cam:
      if (applyCameraSetting(cmd.key, cmd.arg)) {
        broadcastState();
      } else {
        client->text("{\"type\":\"error\",\"msg\":\"camera setting rejected\"}");
      }
      break;
    case CmdType::Invalid:
      break;
  }
}

void onWsEvent(AsyncWebSocket*, AsyncWebSocketClient* client, AwsEventType type, void* arg, uint8_t* data,
               size_t len) {
  switch (type) {
    case WS_EVT_CONNECT: {
      client->client()->setNoDelay(true);  // send small frames immediately
      client->keepAlivePeriod(5);          // ping idle clients so dead phones drop out
      LOG("client #%lu connected from %s", static_cast<unsigned long>(client->id()),
          client->remoteIP().toString().c_str());
      char json[512];
      writeStateJson(json, sizeof(json));
      client->text(json);
      break;
    }
    case WS_EVT_DISCONNECT: {
      portENTER_CRITICAL(&driveMux);
      if (client->id() == driverClientId) {
        driveTarget = {0, 0};
        driverClientId = 0;
      }
      portEXIT_CRITICAL(&driveMux);
      LOG("client #%lu disconnected", static_cast<unsigned long>(client->id()));
      break;
    }
    case WS_EVT_DATA: {
      const auto* info = static_cast<const AwsFrameInfo*>(arg);
      // Commands are short single-frame text messages; ignore anything else.
      if (!info->final || info->index != 0 || info->len != len || info->opcode != WS_TEXT) return;
      handleMessage(client, reinterpret_cast<const char*>(data), len);
      break;
    }
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------
void startWifi() {
  WiFi.persistent(false);
  WiFi.setHostname(TELEBOT_HOSTNAME);

  if (strlen(WIFI_STA_SSID) > 0) {
    WiFi.mode(WIFI_STA);
    WiFi.setSleep(false);  // modem sleep adds 100+ ms of latency per packet
    WiFi.setAutoReconnect(true);
    WiFi.begin(WIFI_STA_SSID, WIFI_STA_PASS);
    LOG("joining \"%s\"", WIFI_STA_SSID);
    const uint32_t start = millis();
    bool led = false;
    while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_CONNECT_TIMEOUT_MS) {
      led = !led;
      digitalWrite(PIN_STATUS_LED, led ? LOW : HIGH);  // fast blink while joining
      delay(200);
    }
    if (WiFi.status() == WL_CONNECTED) {
      apMode = false;
      LOG("connected: http://%s  (http://%s.local)  RSSI %d dBm", WiFi.localIP().toString().c_str(),
          TELEBOT_HOSTNAME, WiFi.RSSI());
      return;
    }
    LOG("could not join \"%s\"; starting access point", WIFI_STA_SSID);
    WiFi.disconnect(true);
  }

  char ssid[24];
  snprintf(ssid, sizeof(ssid), "TeleBot-%04X", static_cast<unsigned>((ESP.getEfuseMac() >> 32) & 0xFFFF));
  WiFi.mode(WIFI_AP);
  WiFi.softAP(ssid, WIFI_AP_PASS, 6, 0, 4);
  WiFi.setSleep(false);
  apMode = true;
  LOG("access point \"%s\" up: http://%s", ssid, WiFi.softAPIP().toString().c_str());
}

void startOtaAndMdns() {
#ifdef OTA_PASSWORD
  ArduinoOTA.setHostname(TELEBOT_HOSTNAME);
  ArduinoOTA.setPassword(OTA_PASSWORD);
  ArduinoOTA.onStart([] {
    otaActive = true;
    stopAll();
    setDriverAwake(false);
    LOG("OTA update started");
  });
  ArduinoOTA.onEnd([] { LOG("OTA update done, rebooting"); });
  ArduinoOTA.onError([](ota_error_t error) {
    otaActive = false;
    setDriverAwake(true);
    LOG("OTA update failed (%u)", static_cast<unsigned>(error));
  });
  ArduinoOTA.begin();  // also starts mDNS under TELEBOT_HOSTNAME
#else
  MDNS.begin(TELEBOT_HOSTNAME);
#endif
  MDNS.addService("http", "tcp", 80);
}

void startWebServer() {
  ws.onEvent(onWsEvent);
  ws.handleHandshake([](AsyncWebServerRequest* request) {
    if (kAccessToken[0] == '\0') return true;
    const AsyncWebParameter* p = request->getParam("token");
    return p != nullptr && tokenMatches(p->value().c_str());
  });
  server.addHandler(&ws);

  server.on("/", HTTP_GET, [](AsyncWebServerRequest* request) {
    AsyncWebServerResponse* res =
        request->beginResponse(200, "text/html", WEB_INDEX_HTML_GZ, WEB_INDEX_HTML_GZ_LEN);
    res->addHeader("Content-Encoding", "gzip");
    res->addHeader("Cache-Control", "no-cache");
    request->send(res);
  });

  server.on("/status", HTTP_GET, [](AsyncWebServerRequest* request) {
    char json[512];
    writeStateJson(json, sizeof(json));
    request->send(200, "application/json", json);
  });

  server.onNotFound([](AsyncWebServerRequest* request) { request->send(404, "text/plain", "Not found"); });

  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", "*");
  server.begin();
}

// ---------------------------------------------------------------------------
// Settings persistence (NVS)
// ---------------------------------------------------------------------------
void loadPrefs() {
  prefs.begin("telebot", false);  // read-write: a read-only open logs an error on first boot
  speedPct = static_cast<uint8_t>(telebot::clampInt(prefs.getUChar("speed", DEFAULT_SPEED_PCT), 0, 100));
  const uint8_t fs = prefs.getUChar("fs", CAMERA_DEFAULT_FRAMESIZE);
  for (const auto& f : kFrameSizes) {
    if (f.size == fs) cam.frameSize = f.size;  // ignore unknown stored values
  }
  cam.quality = telebot::clampInt(prefs.getUChar("q", CAMERA_DEFAULT_QUALITY), 10, 63);
  cam.vflip = prefs.getUChar("vflip", CAMERA_DEFAULT_VFLIP) ? 1 : 0;
  cam.hmirror = prefs.getUChar("hmir", CAMERA_DEFAULT_HMIRROR) ? 1 : 0;
  prefs.end();
}

void savePrefs() {
  prefs.begin("telebot", false);
  prefs.putUChar("speed", speedPct);
  prefs.putUChar("fs", static_cast<uint8_t>(cam.frameSize));
  prefs.putUChar("q", static_cast<uint8_t>(cam.quality));
  prefs.putUChar("vflip", static_cast<uint8_t>(cam.vflip));
  prefs.putUChar("hmir", static_cast<uint8_t>(cam.hmirror));
  prefs.end();
}

void updateStatusLed(uint32_t now) {
  // Solid when someone is connected, otherwise a short blink every 2 s.
  const bool on = ws.count() > 0 || (now % 2000) < 60;
  digitalWrite(PIN_STATUS_LED, on ? LOW : HIGH);
}

}  // namespace

void setup() {
  holdMotorPinsLow();  // before anything slow, so the wheels cannot twitch
#if DISABLE_BROWNOUT_DETECTOR
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
#endif
  pinMode(PIN_STATUS_LED, OUTPUT);
  digitalWrite(PIN_STATUS_LED, HIGH);

  Serial.begin(115200);
  LOG("TeleBot %s starting", TELEBOT_FW_VERSION);

  loadPrefs();
  cameraOk = initCamera();
  initMotors();
  pwmAttach(PIN_FLASH_LED, LEDC_CH_LIGHT, LIGHT_PWM_FREQ_HZ, LIGHT_PWM_BITS);
  setLight(0);

  startWifi();
  startOtaAndMdns();
  startWebServer();
  if (cameraOk) startStreamServer();
  LOG("ready (free heap %lu, PSRAM %lu)", static_cast<unsigned long>(ESP.getFreeHeap()),
      static_cast<unsigned long>(ESP.getFreePsram()));
}

void loop() {
  static uint32_t nextControlMs = 0;
  static uint32_t nextTelemetryMs = 0;
  static uint32_t lastFrames = 0;
  static uint32_t lastFpsMs = 0;
  const uint32_t now = millis();

#ifdef OTA_PASSWORD
  ArduinoOTA.handle();
#endif

  if (static_cast<int32_t>(now - nextControlMs) >= 0) {
    nextControlMs = now + CONTROL_PERIOD_MS;
    controlTick();
  }

  if (static_cast<int32_t>(now - nextTelemetryMs) >= 0) {
    nextTelemetryMs = now + TELEMETRY_PERIOD_MS;
    const uint32_t frames = streamFrames;
    if (now != lastFpsMs) streamFps = (frames - lastFrames) * 1000.0f / (now - lastFpsMs);
    lastFrames = frames;
    lastFpsMs = now;

    ws.cleanupClients();
    if (ws.count() > 0) {
      char json[320];
      writeTelemetryJson(json, sizeof(json));
      ws.textAll(json);
    }
  }

  if (prefsDirty && now - prefsDirtyMs > PREFS_SAVE_DELAY_MS) {
    prefsDirty = false;
    savePrefs();
  }

  updateStatusLed(now);
  delay(1);
}
