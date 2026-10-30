#!/usr/bin/env bash
# Verifies the TeleBot project tree. Every check that needs a tool which is
# not installed is reported as SKIP rather than failing, so this runs anywhere
# with Python 3 and a C++ compiler, and does more where more is installed.
#
#   scripts/verify.sh          (or: make verify)
set -uo pipefail

cd "$(dirname "$0")/.."
ROOT=$(pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

pass=0; fail=0; skip=0
ok()   { echo "  PASS  $*"; pass=$((pass + 1)); }
bad()  { echo "  FAIL  $*"; fail=$((fail + 1)); }
skp()  { echo "  SKIP  $*"; skip=$((skip + 1)); }
have() { command -v "$1" >/dev/null 2>&1; }
section() { echo; echo "== $*"; }

section "Project structure"
required=(
  README.md Makefile
  docs/architecture.md docs/bom.csv
  firmware/platformio.ini firmware/src/main.cpp
  firmware/include/config.h firmware/include/drive.h firmware/include/secrets.example.h
  firmware/scripts/embed_web.py firmware/test/test_drive/test_main.cpp
  web/index.html
  chassis/lib/telebot_common.scad chassis/chassis_base.scad chassis/caster_holder.scad
  chassis/esp32cam_bracket.scad chassis/assembly.scad chassis/wheel.scad chassis/tire_tpu.scad
  chassis/push_pin.scad chassis/shaft_fit_test.scad chassis/caster_skid.scad docs/printed-parts.md
  scripts/verify.sh scripts/mock_robot.py scripts/e2e_dashboard.js scripts/host-unity/unity.h
)
missing=0
for f in "${required[@]}"; do
  [ -s "$f" ] || { bad "missing or empty: $f"; missing=1; }
done
[ $missing -eq 0 ] && ok "${#required[@]} required files present"

if have git && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git ls-files --error-unmatch firmware/include/secrets.h >/dev/null 2>&1; then
    bad "firmware/include/secrets.h is tracked by git: it holds passwords"
  else
    ok "secrets.h is not committed"
  fi
fi

section "Bill of materials"
PYTHON=${PYTHON:-python3}
"$PYTHON" - docs/bom.csv <<'EOF' && ok "docs/bom.csv is consistent and within budget" || bad "docs/bom.csv"
import csv, sys
rows = list(csv.DictReader(open(sys.argv[1], newline="")))
cols = ["id", "category", "part", "specification", "qty", "unit_usd", "line_usd", "required", "where_to_look", "notes"]
assert rows and list(rows[0].keys()) == cols, "unexpected columns"
total = {"yes": 0.0, "optional": 0.0}
for r in rows:
    qty, unit, line = int(r["qty"]), float(r["unit_usd"]), float(r["line_usd"])
    assert abs(qty * unit - line) < 0.005, "row %s: %d x %.2f != %.2f" % (r["id"], qty, unit, line)
    assert r["required"] in total, "row %s: required must be yes/optional" % r["id"]
    total[r["required"]] += line
for word in ("ESP32-CAM", "DRV8833", "TT gear motor", "18650", "boost", "Caster", "O-ring"):
    assert any(word.lower() in (r["part"] + r["specification"]).lower() for r in rows), "BOM lacks " + word
print("        required parts $%.2f, optional $%.2f (target $30-40 incl. shipping)" % (total["yes"], total["optional"]))
assert total["yes"] <= 40, "required parts exceed $40"
EOF

section "Firmware"
pins=$(grep -E '^#define PIN_[A-Z0-9_]+ +-?[0-9]+' firmware/include/config.h | awk '{print $2"="$3}')
dupes=$(echo "$pins" | cut -d= -f2 | grep -v '^-' | sort | uniq -d)
[ -z "$dupes" ] && ok "no GPIO assigned twice in config.h" || bad "GPIO assigned twice: $dupes"
undocumented=""
for p in $pins; do
  n=${p#*=}; [ "$n" -lt 0 ] && continue
  grep -qE "GPIO $n\b|^\| $n \|" docs/architecture.md || undocumented="$undocumented ${p%=*}(GPIO $n)"
done
[ -z "$undocumented" ] && ok "every pin in config.h appears in docs/architecture.md" || bad "pins missing from the docs:$undocumented"
for pin in 0 5 16 18 19 21 22 23 25 26 27 32 34 35 36 39; do
  if echo "$pins" | grep -qE "=$pin$"; then bad "config.h uses GPIO $pin, which belongs to the camera/PSRAM"; fi
done
ok "no motor/LED pin collides with camera or PSRAM pins"

grep -q '^\[env:esp32cam\]' firmware/platformio.ini && grep -q 'ESPAsyncWebServer' firmware/platformio.ini \
  && grep -q 'extra_scripts = pre:scripts/embed_web.py' firmware/platformio.ini \
  && ok "platformio.ini: esp32cam env, libraries, embed step" || bad "platformio.ini is missing an expected setting"

if "$PYTHON" -m py_compile firmware/scripts/embed_web.py scripts/mock_robot.py 2>"$TMP/pyc"; then
  ok "Python scripts compile"
else
  bad "Python syntax: $(cat "$TMP/pyc")"
fi

if "$PYTHON" firmware/scripts/embed_web.py >"$TMP/embed" 2>&1; then
  ok "$(sed 's/^embed_web: //' "$TMP/embed")"
  size=$(grep -o 'WEB_INDEX_HTML_GZ_LEN = [0-9]*' firmware/include/web_index.h | grep -o '[0-9]*$')
  [ "${size:-999999}" -lt 65536 ] && ok "embedded dashboard is ${size} bytes gzipped" || bad "embedded dashboard too large (${size} bytes)"
else
  bad "embed_web.py: $(cat "$TMP/embed")"
fi

CXX=${CXX:-g++}
if have "$CXX"; then
  # The generated header must compile and its bytes must gunzip back to web/index.html.
  printf '#include <stdio.h>\n#include "web_index.h"\nint main(){fwrite(WEB_INDEX_HTML_GZ,1,WEB_INDEX_HTML_GZ_LEN,stdout);return 0;}\n' \
    | "$CXX" -std=gnu++17 -Wall -Wextra -Werror -Ifirmware/include -x c++ - -o "$TMP/dump" 2>"$TMP/hdr" \
    && "$TMP/dump" | "$PYTHON" -c 'import gzip,sys; sys.exit(gzip.decompress(sys.stdin.buffer.read()) != open("web/index.html","rb").read())' \
    && ok "web_index.h compiles and gunzips to exactly web/index.html" \
    || bad "web_index.h: $(head -3 "$TMP/hdr")"
  if "$CXX" -std=gnu++17 -Wall -Wextra -Werror -Iscripts/host-unity -Ifirmware/include \
       firmware/test/test_drive/test_main.cpp -o "$TMP/test_drive" 2>"$TMP/cc" && "$TMP/test_drive" >"$TMP/tests"; then
    ok "drive-logic unit tests: $(tail -1 "$TMP/tests")"
  else
    bad "drive-logic unit tests"; cat "$TMP/cc" "$TMP/tests" 2>/dev/null | grep -E 'FAIL|error' | head -10
  fi
else
  skp "no C++ compiler: unit tests"
fi

if have pio && [ "${VERIFY_SKIP_PIO:-0}" != 1 ]; then
  if (cd firmware && pio run -e esp32cam) >"$TMP/pio" 2>&1; then
    ok "PlatformIO build: $(grep -E '^Flash:' "$TMP/pio" | head -1)"
  else
    bad "PlatformIO build"; tail -20 "$TMP/pio"
  fi
  if (cd firmware && pio test -e native) >"$TMP/piot" 2>&1; then ok "pio test -e native"; else bad "pio test -e native"; tail -10 "$TMP/piot"; fi
else
  skp "PlatformIO not installed: firmware cross-compile (make setup && make build)"
fi

section "Web dashboard"
"$PYTHON" - web/index.html "$TMP/dashboard.js" <<'EOF' && ok "index.html: balanced markup, self-contained (no external requests)" || bad "web/index.html markup"
import re, sys
from html.parser import HTMLParser
VOID = {"meta", "link", "img", "input", "br", "hr", "source", "path", "circle", "rect"}
class P(HTMLParser):
    def __init__(self):
        super().__init__(); self.stack = []; self.scripts = []; self.in_script = False; self.ext = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for k in ("src", "href"):
            v = a.get(k) or ""
            if re.match(r"(https?:)?//", v): self.ext.append(v)
        if tag == "script":
            self.in_script = True; self.scripts.append("")
        if tag not in VOID: self.stack.append(tag)
    def handle_startendtag(self, tag, attrs): pass
    def handle_endtag(self, tag):
        if tag in VOID: return
        assert self.stack and self.stack[-1] == tag, "unbalanced </%s> (open: %s)" % (tag, self.stack[-3:])
        self.stack.pop()
        if tag == "script": self.in_script = False
    def handle_data(self, data):
        if self.in_script: self.scripts[-1] += data
p = P(); p.feed(open(sys.argv[1]).read()); p.close()
assert not p.stack, "unclosed tags: %s" % p.stack
assert not p.ext, "external resources: %s" % p.ext
assert len(p.scripts) == 1, "expected one inline script"
open(sys.argv[2], "w").write(p.scripts[0])
EOF
if have node; then
  node --check "$TMP/dashboard.js" 2>"$TMP/js" && ok "dashboard JavaScript parses" || bad "dashboard JavaScript: $(head -5 "$TMP/js")"
  for cmd in "joy " "move " "'stop'" "speed " "light " "ping " "cam "; do
    grep -q "$cmd" web/index.html || bad "dashboard never sends $cmd"
  done
  ok "dashboard sends every protocol command"
  if node -e "require('playwright')" 2>/dev/null; then
    if node scripts/e2e_dashboard.js >"$TMP/e2e" 2>&1; then
      ok "end-to-end against the mock robot: $(grep -c '^PASS' "$TMP/e2e") checks"
    else
      bad "end-to-end dashboard test"; grep -E '^FAIL' "$TMP/e2e" | head -10
    fi
  else
    skp "Playwright not installed: end-to-end dashboard test (npm i playwright)"
  fi
else
  skp "Node.js not installed: dashboard JavaScript checks"
fi

section "Chassis (OpenSCAD)"
PARTS="chassis_base caster_holder caster_skid esp32cam_bracket wheel tire_tpu push_pin shaft_fit_test"
if have openscad; then
  for part in $PARTS; do
    if openscad -o "$TMP/$part.stl" "chassis/$part.scad" >"$TMP/$part.log" 2>&1 \
       && ! grep -qiE '^(WARNING|ERROR)' "$TMP/$part.log" && grep -q 'Simple: *yes' "$TMP/$part.log"; then
      ok "$part renders to a manifold solid ($(grep -c 'facet normal' "$TMP/$part.stl") facets)"
    else
      bad "$part"; grep -iE 'warning|error|assert' "$TMP/$part.log" | head -5
    fi
  done
  openscad -o "$TMP/assembly.csg" chassis/assembly.scad >"$TMP/asm.log" 2>&1 && ! grep -qiE '^(WARNING|ERROR)' "$TMP/asm.log" \
    && ok "assembly preview evaluates cleanly" || { bad "assembly.scad"; head -5 "$TMP/asm.log"; }
else
  skp "OpenSCAD not installed: chassis render (prebuilt STLs are in chassis/stl/)"
fi
for part in $PARTS; do
  [ -s "chassis/stl/$part.stl" ] || bad "chassis/stl/$part.stl missing (make stl)"
done

echo
echo "verify: $pass passed, $fail failed, $skip skipped"
[ $fail -eq 0 ]
