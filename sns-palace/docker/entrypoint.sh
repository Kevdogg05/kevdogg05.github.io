#!/bin/sh
# Starts as root just long enough to give the data folder (often a freshly
# mounted disk, owned by root) to the unprivileged "palace" user, then runs
# again as that user.
set -eu

data="${LOCAL_DATA_DIR:-/data}"
if [ "$(id -u)" = 0 ]; then
  mkdir -p "$data"
  # Includes files copied in from outside, such as videos from an earlier setup.
  find "$data" ! -user palace -exec chown palace:palace {} +
  exec setpriv --reuid=palace --regid=palace --init-groups -- "$0" "$@"
fi

# No SESSION_SECRET given: make one and keep it with the data, so devices stay
# signed in across restarts.
if [ -z "${SESSION_SECRET:-}" ]; then
  secret="$data/.session-secret"
  if [ ! -s "$secret" ]; then
    (umask 077 && head -c 48 /dev/urandom | base64 -w 0 > "$secret")
  fi
  SESSION_SECRET="$(cat "$secret")"
  export SESSION_SECRET
fi
exec "$@"
