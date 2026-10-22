#!/bin/bash
# Runs the web app and the editing worker side by side in the container. If
# either one stops, the other is stopped too and the container exits with an
# error, so the host restarts both.
set -u

node --import ./docker/long-uploads.mjs node_modules/next/dist/bin/next start --hostname 0.0.0.0 &
web=$!
node --import tsx worker/index.ts &
worker=$!

stopping=0
stop() {
  stopping=1
  kill -TERM "$web" "$worker" 2>/dev/null
}
trap stop TERM INT

wait -n "$web" "$worker"
status=$?
if [ "$stopping" = 0 ]; then
  echo "start.sh: a process exited (status $status); stopping the other one" >&2
  [ "$status" = 0 ] && status=1
fi
stop
wait
exit "$status"
