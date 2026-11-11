#!/bin/sh
# Writes the browser-facing API address from the API_URL environment variable.
set -eu
url="${API_URL:-${VITE_API_URL:-http://localhost:8080}}"
escaped=$(printf '%s' "$url" | sed 's/\\/\\\\/g; s/"/\\"/g')
printf 'window.__APP_CONFIG__ = { apiUrl: "%s" };\n' "$escaped" > /usr/share/nginx/html/runtime-config.js
echo "Frontend will call the API at $url"
