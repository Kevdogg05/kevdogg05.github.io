// Copy this file to secrets.h (same folder) and fill it in. secrets.h is
// gitignored. Without it the robot starts its own Wi-Fi network instead.
#pragma once

// Home Wi-Fi (2.4 GHz only). Leave WIFI_STA_SSID empty to always run as an
// access point.
#define WIFI_STA_SSID "your-network-name"
#define WIFI_STA_PASS "your-network-password"

// Password for the robot's own network "TeleBot-XXXX", used when the home
// network is unreachable. At least 8 characters.
#define WIFI_AP_PASS "change-this-password"

// Over-the-air updates (`make ota`). Delete this line to disable OTA.
#define OTA_PASSWORD "change-this-too"

// Optional: require ?token=... on the control socket and the video stream.
// The dashboard asks for it once and remembers it. Leave empty to disable.
#define ACCESS_TOKEN ""
