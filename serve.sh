#!/usr/bin/env sh
# Start a local server for Murda Worth Street Racing and open it in your browser.
cd "$(dirname "$0")"
PORT=${PORT:-8000}
URL="http://localhost:$PORT"
echo "Murda Worth Street Racing → $URL  (Ctrl+C to stop)"
( sleep 1; command -v xdg-open >/dev/null && xdg-open "$URL" || command -v open >/dev/null && open "$URL" ) >/dev/null 2>&1 &
if command -v python3 >/dev/null; then exec python3 -m http.server "$PORT"; else exec python -m SimpleHTTPServer "$PORT"; fi
