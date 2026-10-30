// config.h: pins and tunables for the TeleBot firmware.
//
// Every value can be overridden from platformio.ini build_flags, for example
//   build_flags = ${esp32_base.build_flags} -DMOTOR_MIN_DUTY=110
// The pin map matches docs/architecture.md; change both together.
#pragma once

#define TELEBOT_FW_VERSION "1.0.0"

#ifndef TELEBOT_HOSTNAME
#define TELEBOT_HOSTNAME "telebot"  // mDNS name: http://telebot.local
#endif

// ---------------------------------------------------------------------------
// Pins: AI-Thinker ESP32-CAM. The camera uses GPIO 0, 5, 18-27, 32, 34-39 and
// PSRAM uses GPIO 16. With the microSD slot unused, GPIO 2, 4, 12-15 are free.
// ---------------------------------------------------------------------------

// Motor driver inputs (DRV8833 AIN1/AIN2/BIN1/BIN2, or L298N IN1..IN4 with the
// ENA/ENB jumpers fitted). GPIO 12 is a strapping pin that must be LOW at
// reset: the DRV8833's internal input pull-downs hold it there.
#ifndef PIN_MOTOR_L_IN1
#define PIN_MOTOR_L_IN1 12
#endif
#ifndef PIN_MOTOR_L_IN2
#define PIN_MOTOR_L_IN2 13
#endif
#ifndef PIN_MOTOR_R_IN1
#define PIN_MOTOR_R_IN1 14
#endif
#ifndef PIN_MOTOR_R_IN2
#define PIN_MOTOR_R_IN2 15
#endif

// DRV8833 nSLEEP (labelled EEP or SLP on most modules). GPIO 2 is pulled low
// during reset, so the driver stays asleep through the ~300 ms boot while
// GPIO 14/15 may glitch, and wakes only once the firmware holds the inputs.
// Set to -1 if nSLEEP is wired to 3V3 instead.
#ifndef PIN_MOTOR_SLEEP
#define PIN_MOTOR_SLEEP 2
#endif

#ifndef PIN_FLASH_LED
#define PIN_FLASH_LED 4  // on-board white LED, used as a headlight
#endif
#ifndef PIN_STATUS_LED
#define PIN_STATUS_LED 33  // on-board red LED, active LOW
#endif

// LEDC channels. Channel 0 / timer 0 drive the camera's XCLK, so motors use
// channels 2-5 (timers 1-2) and the headlight channel 6 (timer 3).
#define LEDC_CH_MOTOR_L1 2
#define LEDC_CH_MOTOR_L2 3
#define LEDC_CH_MOTOR_R1 4
#define LEDC_CH_MOTOR_R2 5
#define LEDC_CH_LIGHT 6

#ifndef MOTOR_PWM_FREQ_HZ
#define MOTOR_PWM_FREQ_HZ 20000  // above hearing range: no motor whine
#endif
#define MOTOR_PWM_BITS 8
#define LIGHT_PWM_FREQ_HZ 5000
#define LIGHT_PWM_BITS 8
#ifndef LIGHT_MAX_DUTY
#define LIGHT_MAX_DUTY 160  // of 255: the flash LED overheats at full power
#endif

// ---------------------------------------------------------------------------
// Drive tuning
// ---------------------------------------------------------------------------
#ifndef FAILSAFE_TIMEOUT_MS
#define FAILSAFE_TIMEOUT_MS 500  // stop if no drive command arrives for this long
#endif
#define CONTROL_PERIOD_MS 10  // 100 Hz ramp/PWM update
#ifndef RAMP_UP_PER_TICK
#define RAMP_UP_PER_TICK 12  // 0 -> full duty in about 210 ms
#endif
#ifndef RAMP_DOWN_PER_TICK
#define RAMP_DOWN_PER_TICK 40  // full duty -> 0 in about 70 ms
#endif
#ifndef MOTOR_MIN_DUTY
#define MOTOR_MIN_DUTY 85  // TT motors stall below about a third of 5 V
#endif
#ifndef MOTOR_SLOW_DECAY
#define MOTOR_SLOW_DECAY 1  // 1: drive/brake PWM, 0: drive/coast PWM
#endif
#ifndef MOTOR_LEFT_INVERT
#define MOTOR_LEFT_INVERT 0  // set to 1 instead of swapping motor wires
#endif
#ifndef MOTOR_RIGHT_INVERT
#define MOTOR_RIGHT_INVERT 0
#endif
#ifndef MOTOR_LEFT_TRIM_PCT
#define MOTOR_LEFT_TRIM_PCT 100  // lower the faster wheel if the robot drifts
#endif
#ifndef MOTOR_RIGHT_TRIM_PCT
#define MOTOR_RIGHT_TRIM_PCT 100
#endif
#ifndef DEFAULT_SPEED_PCT
#define DEFAULT_SPEED_PCT 70
#endif
#ifndef SPIN_SCALE_PCT
#define SPIN_SCALE_PCT 60  // D-pad spins run at 60 % of the speed limit
#endif

// ---------------------------------------------------------------------------
// Camera and streaming
// ---------------------------------------------------------------------------
#define CAMERA_XCLK_HZ 20000000
#ifndef CAMERA_DEFAULT_FRAMESIZE
#define CAMERA_DEFAULT_FRAMESIZE FRAMESIZE_VGA  // 640x480
#endif
#ifndef CAMERA_DEFAULT_QUALITY
#define CAMERA_DEFAULT_QUALITY 12  // JPEG quality 10 (best) .. 63 (worst)
#endif
#ifndef CAMERA_DEFAULT_VFLIP
#define CAMERA_DEFAULT_VFLIP 0  // set to 1 if the board is mounted antenna-down
#endif
#ifndef CAMERA_DEFAULT_HMIRROR
#define CAMERA_DEFAULT_HMIRROR 0
#endif
#define STREAM_PORT 81
#ifndef STREAM_MAX_FPS
#define STREAM_MAX_FPS 20  // cap so video never starves the control channel
#endif

// ---------------------------------------------------------------------------
// Network and housekeeping
// ---------------------------------------------------------------------------
#ifndef WIFI_CONNECT_TIMEOUT_MS
#define WIFI_CONNECT_TIMEOUT_MS 15000  // then fall back to access-point mode
#endif
#define TELEMETRY_PERIOD_MS 1000
#define PREFS_SAVE_DELAY_MS 3000  // batch NVS writes while a slider moves
#ifndef DISABLE_BROWNOUT_DETECTOR
#define DISABLE_BROWNOUT_DETECTOR 0  // last resort only; fix the power supply first
#endif
