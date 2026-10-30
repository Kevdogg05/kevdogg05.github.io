# TeleBot: a $30 Wi-Fi telepresence robot

A two-wheel robot with a live camera that you drive from a phone browser. An
ESP32-CAM serves its own dashboard, streams MJPEG video and drives two TT gear
motors through a DRV8833, all from one 18650 cell. The chassis is three
3D-printed parts.

![Dashboard on a phone in landscape](docs/img/dashboard-landscape.png)

* **Parts:** $23.78 required ([docs/bom.csv](docs/bom.csv)), ~$30-35 with shipping and spares.
* **Control:** joystick, D-pad (forward, reverse, spin left, spin right, stop),
  keyboard or gamepad, over a WebSocket at 20 Hz. The robot stops by itself
  500 ms after commands stop arriving.
* **Video:** 320x240 to 800x600 MJPEG, up to 20 fps, on its own server so it
  never delays a drive command.
* **Network:** joins your Wi-Fi, or starts its own (`TeleBot-XXXX`,
  `http://192.168.4.1/`) when it can't. Over-the-air firmware updates.

Full design, pinout, wiring, protocol and troubleshooting:
**[docs/architecture.md](docs/architecture.md)**.

## Layout

| Path | Contents |
|---|---|
| `docs/architecture.md` | Architecture, power design, ASCII pinout and wiring diagrams, firmware design, protocol, chassis, troubleshooting |
| `docs/bom.csv` | Bill of materials with prices and sourcing notes |
| `firmware/` | PlatformIO project: `src/main.cpp`, pins and tuning in `include/config.h`, testable drive logic in `include/drive.h` |
| `web/index.html` | The dashboard: one self-contained file, embedded into the firmware at build time |
| `chassis/` | OpenSCAD sources (base, caster holder, camera bracket, assembly preview) and ready-to-print `stl/` |
| `scripts/` | `verify.sh`, the mock robot, the dashboard end-to-end test |
| `Makefile` | Every build, flash, test and render command |

## Quick start

```sh
cd telepresence-bot
make setup                                                  # installs PlatformIO
cp firmware/include/secrets.example.h firmware/include/secrets.h
$EDITOR firmware/include/secrets.h                          # Wi-Fi name/password, OTA password
make build                                                  # embeds web/index.html, compiles
make upload                                                 # ESP32-CAM seated on the ESP32-CAM-MB, USB
make monitor                                                # shows http://<address>/
```

Then open the printed address (or `http://telebot.local/`) on your phone.

No robot yet? `make mock` runs a simulated robot with the same protocol at
`http://localhost:8080/`.

## Verification

`make verify` checks the whole tree and runs everything the installed tools
allow: required files, BOM arithmetic and budget, pin map against the docs, no
pin clashing with the camera, dashboard markup and JavaScript, the embedded
dashboard header, drive-logic unit tests, the end-to-end dashboard test
(Playwright), OpenSCAD renders, and the PlatformIO build when PlatformIO is
installed. Missing tools are reported as skipped, not failed.

| Make target | What it runs |
|---|---|
| `make test` | Drive-logic unit tests (mixing, ramp, PWM mapping, protocol parser) with the host compiler |
| `make test-pio` | The same tests under PlatformIO's Unity runner |
| `make e2e` | Headless Chromium drives the dashboard against the mock robot and checks the commands it receives |
| `make stl` | Re-renders the STLs |
| `make build` / `make arduino-build` | Firmware compile with PlatformIO / Arduino CLI |
