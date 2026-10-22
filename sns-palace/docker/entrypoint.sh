#!/bin/sh
# Starts as root just long enough to give the data folder (often a freshly
# mounted disk, owned by root) to the unprivileged "palace" user, then runs the
# app as that user.
set -eu

data="${LOCAL_DATA_DIR:-/data}"
if [ "$(id -u)" = 0 ]; then
  mkdir -p "$data"
  if [ "$(stat -c %U "$data")" != palace ]; then
    chown -R palace:palace "$data"
  fi
  exec setpriv --reuid=palace --regid=palace --init-groups -- "$@"
fi
exec "$@"
