#!/bin/sh
# Writes the Caddyfile from the environment, then starts Caddy.
#   OAS_DOMAIN    public hostname (e.g. studio.example.com) for automatic HTTPS;
#                 empty serves plain HTTP on port 80 inside the container
#   OAS_PASSWORD  if set, every page and API call asks for a login
#   OAS_USERNAME  login name (default: admin)
set -eu

site="${OAS_DOMAIN:-}"
[ -n "$site" ] || site=":80"

auth=""
if [ -n "${OAS_PASSWORD:-}" ]; then
  hash="$(caddy hash-password --plaintext "$OAS_PASSWORD")"
  auth="basic_auth {
		${OAS_USERNAME:-admin} $hash
	}"
  echo "oas-proxy: password protection on (user: ${OAS_USERNAME:-admin})"
else
  echo "oas-proxy: no password set; anyone who can reach this port can use the studio"
fi

cat > /etc/caddy/Caddyfile <<CADDY
$site {
	$auth
	# The API, its docs and rendered media are served by the backend...
	@backend path /api/* /media/* /docs /docs/* /openapi.json
	handle @backend {
		reverse_proxy backend:8000
	}
	# ...and everything else by the Next.js dashboard.
	handle {
		reverse_proxy frontend:3000
	}
}
CADDY

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
