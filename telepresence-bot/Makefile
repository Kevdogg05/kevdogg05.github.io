# TeleBot: build, flash, test and verify.   Run `make help` for the list.
#
# PlatformIO is the main build. Arduino CLI is supported as an alternative
# (arduino-deps / arduino-build / arduino-upload).

SHELL := /bin/bash
.DEFAULT_GOAL := help

FW          := firmware
BUILD       := build
PYTHON      ?= python3
CXX         ?= g++
PIO         ?= pio
ARDUINO_CLI ?= arduino-cli
OPENSCAD    ?= openscad
PORT        ?=
HOST        ?=
MOCK_ARGS   ?=

ESP32_INDEX := https://espressif.github.io/arduino-esp32/package_esp32_index.json
ESP32_CORE  ?= 3.3.12
FQBN        ?= esp32:esp32:esp32cam
SKETCH      := $(BUILD)/arduino/telebot
PARTS       := chassis_base caster_holder esp32cam_bracket

.PHONY: help setup embed build upload monitor ota test test-pio e2e mock stl \
        arduino-deps arduino-build arduino-upload verify clean

help: ## list targets
	@grep -E '^[a-z0-9-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-15s %s\n", $$1, $$2}'

setup: ## install PlatformIO (once)
	$(PYTHON) -m pip install --user --upgrade platformio

embed: ## gzip web/index.html into firmware/include/web_index.h
	$(PYTHON) $(FW)/scripts/embed_web.py

build: ## compile the firmware (PlatformIO; embeds the dashboard first)
	cd $(FW) && $(PIO) run -e esp32cam

upload: ## flash over USB (ESP32-CAM-MB); PORT=/dev/ttyUSB0 to choose the port
	cd $(FW) && $(PIO) run -e esp32cam -t upload $(if $(PORT),--upload-port $(PORT))

monitor: ## serial monitor at 115200
	cd $(FW) && $(PIO) device monitor -e esp32cam $(if $(PORT),--port $(PORT))

ota: ## flash over Wi-Fi; needs TELEBOT_OTA_PASSWORD, HOST=ip to override telebot.local
	@test -n "$$TELEBOT_OTA_PASSWORD" || { echo "Set TELEBOT_OTA_PASSWORD to the OTA_PASSWORD in firmware/include/secrets.h"; exit 1; }
	cd $(FW) && $(PIO) run -e ota -t upload $(if $(HOST),--upload-port $(HOST))

test: ## drive-logic unit tests with the host C++ compiler
	@mkdir -p $(BUILD)
	$(CXX) -std=gnu++17 -Wall -Wextra -Werror -Iscripts/host-unity -I$(FW)/include \
	    $(FW)/test/test_drive/test_main.cpp -o $(BUILD)/test_drive
	$(BUILD)/test_drive

test-pio: ## the same tests through PlatformIO and the real Unity framework
	cd $(FW) && $(PIO) test -e native

e2e: ## dashboard end-to-end test in headless Chromium (needs Playwright)
	node scripts/e2e_dashboard.js

mock: ## run the simulated robot: http://localhost:8080/  (MOCK_ARGS="--bind 0.0.0.0")
	$(PYTHON) scripts/mock_robot.py $(MOCK_ARGS)

stl: ## re-render chassis/stl/*.stl from the OpenSCAD sources
	@mkdir -p chassis/stl
	@for p in $(PARTS); do echo "openscad $$p"; $(OPENSCAD) -q -o chassis/stl/$$p.stl chassis/$$p.scad || exit 1; done

arduino-deps: ## Arduino CLI: install the ESP32 core and libraries (once)
	$(ARDUINO_CLI) core update-index --additional-urls $(ESP32_INDEX)
	$(ARDUINO_CLI) core install esp32:esp32@$(ESP32_CORE) --additional-urls $(ESP32_INDEX)
	$(ARDUINO_CLI) lib install "Async TCP@3.5.0" "ESP Async WebServer@3.12.1"

arduino-build: embed ## Arduino CLI: compile (sketch assembled in build/arduino/telebot)
	rm -rf $(SKETCH) && mkdir -p $(SKETCH)
	cp $(FW)/src/main.cpp $(FW)/include/*.h $(SKETCH)/
	echo '// Arduino CLI entry point. The firmware is main.cpp, copied from firmware/src.' > $(SKETCH)/telebot.ino
	$(ARDUINO_CLI) compile --fqbn $(FQBN) \
	    --build-property build.partitions=min_spiffs \
	    --build-property upload.maximum_size=1966080 \
	    --output-dir $(BUILD)/arduino/out $(SKETCH)

arduino-upload: ## Arduino CLI: flash over USB, PORT=/dev/ttyUSB0
	@test -n "$(PORT)" || { echo "Set PORT, e.g. make arduino-upload PORT=/dev/ttyUSB0"; exit 1; }
	$(ARDUINO_CLI) upload -p $(PORT) --fqbn $(FQBN) --input-dir $(BUILD)/arduino/out $(SKETCH)

verify: ## check the project: files, BOM, dashboard, tests, CAD, and builds where tools exist
	scripts/verify.sh

clean: ## remove build output
	rm -rf $(BUILD) $(FW)/.pio $(FW)/include/web_index.h
