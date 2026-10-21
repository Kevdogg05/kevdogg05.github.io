#!/usr/bin/env bash
# Start the FastAPI backend and the Next.js frontend together (Ctrl+C stops both).
#   BACKEND_PORT (8000), FRONTEND_PORT (3000), BACKEND_HOST (127.0.0.1)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

if [ ! -x "$ROOT/backend/.venv/bin/uvicorn" ]; then
  echo "==> Creating backend virtualenv (first run)"
  python3 -m venv "$ROOT/backend/.venv"
  "$ROOT/backend/.venv/bin/pip" install -r "$ROOT/backend/requirements.txt"
fi

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "==> Installing frontend dependencies (first run)"
  (cd "$ROOT/frontend" && npm install)
fi

# The frontend assumes port 8000 unless told otherwise.
if [ "$BACKEND_PORT" != "8000" ] && [ -z "${NEXT_PUBLIC_API_URL:-}" ]; then
  export NEXT_PUBLIC_API_URL="http://localhost:$BACKEND_PORT"
fi

trap 'trap - EXIT; kill 0' EXIT INT TERM

# Only reload for our own code: not for pip installs, engine checkouts or renders.
mkdir -p "$ROOT/backend/storage" "$ROOT/backend/engines"
(cd "$ROOT/backend" && exec .venv/bin/uvicorn main:app --reload \
  --reload-exclude .venv --reload-exclude engines --reload-exclude storage \
  --host "$BACKEND_HOST" --port "$BACKEND_PORT") &
(cd "$ROOT/frontend" && exec npm run dev -- --port "$FRONTEND_PORT") &

echo
echo "  Frontend  http://localhost:$FRONTEND_PORT"
echo "  Backend   http://localhost:$BACKEND_PORT  (API docs: /docs)"
echo

wait
