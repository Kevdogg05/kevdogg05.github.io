#!/usr/bin/env bash
# Makes a test clip that looks like a kid's phone video: portrait, with spoken
# lines separated by long awkward pauses (and one before the first line), over
# faint room noise. Upload it to watch the pipeline trim and caption it.
#
#   npm run sample                       # writes data/samples/talking-demo.mp4
#   bash worker/make-sample-video.sh out.mov
#
# Speech comes from ffmpeg's built-in flite voice when available (most Linux
# builds); otherwise tones stand in for the spoken lines.
set -euo pipefail

out="${1:-data/samples/talking-demo.mp4}"
mkdir -p "$(dirname "$out")"
ffmpeg_bin="${FFMPEG_PATH:-ffmpeg}"

lines=(
  "Hi everyone! Welcome to my channel."
  "Today I am building a giant rocket out of blocks."
  "Thanks for watching, see you next time. Bye!"
)
# Pause before each line, then after the last one (seconds).
pauses=(2.5 3 2.5 2)

# Capture first: piping into grep -q would SIGPIPE ffmpeg and trip pipefail.
filters="$("$ffmpeg_bin" -hide_banner -filters 2>/dev/null || true)"
if grep -q " flite " <<<"$filters"; then
  speech() { printf "flite=text='%s':voice=slt" "${1//\'/}"; }
else
  echo "ffmpeg has no flite voice; using tones for the spoken lines." >&2
  speech() { printf "sine=frequency=440:sample_rate=16000:duration=%s" "$(( ${#1} / 12 + 1 ))"; }
fi

inputs=()
labels=""
n=0
add() { # $1 = lavfi source
  inputs+=(-f lavfi -i "$1")
  labels+="[$n:a]aformat=sample_fmts=fltp:sample_rates=16000:channel_layouts=mono[s$n];"
  n=$((n + 1))
}
for i in "${!lines[@]}"; do
  add "anullsrc=r=16000:cl=mono:d=${pauses[$i]}"
  add "$(speech "${lines[$i]}")"
done
add "anullsrc=r=16000:cl=mono:d=${pauses[-1]}"

concat=""
for ((i = 0; i < n; i++)); do concat+="[s$i]"; done

# Room noise at about -55 dB keeps the pauses realistic rather than digitally silent.
"$ffmpeg_bin" -hide_banner -loglevel error -y "${inputs[@]}" \
  -f lavfi -i "testsrc2=size=720x1280:rate=30" \
  -f lavfi -i "anoisesrc=color=pink:amplitude=0.002:sample_rate=16000" \
  -filter_complex "${labels}${concat}concat=n=$n:v=0:a=1[speech];[$((n + 1)):a]aformat=sample_fmts=fltp:sample_rates=16000:channel_layouts=mono[noise];[speech][noise]amix=inputs=2:duration=first:normalize=0,aresample=48000,pan=stereo|c0=c0|c1=c0[a]" \
  -map "$n:v" -map "[a]" -shortest \
  -c:v libx264 -preset veryfast -crf 26 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart \
  "$out"

duration=$("${FFPROBE_PATH:-ffprobe}" -v error -show_entries format=duration -of csv=p=0 "$out")
echo "Wrote $out (${duration}s)"
