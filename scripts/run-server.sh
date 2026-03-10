#!/bin/bash

set -euo pipefail

PORT=${1:-9001}
STRICT_PORT=${STRICT_PORT:-0}

is_port_in_use() {
    local port="$1"

    if command -v lsof >/dev/null 2>&1; then
        lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
        return $?
    fi

    python3 - "$port" <<'PY'
import socket
import sys

port = int(sys.argv[1])
with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        s.bind(("127.0.0.1", port))
    except OSError:
        raise SystemExit(0)
    raise SystemExit(1)
PY
}

if is_port_in_use "$PORT"; then
    if [ "$STRICT_PORT" = "1" ]; then
        echo "Port ${PORT} is already in use. Set a different port: ./scripts/run-server.sh <port>"
        exit 1
    fi

    original_port="$PORT"
    while is_port_in_use "$PORT"; do
        PORT=$((PORT + 1))
    done
    echo "Port ${original_port} is in use; switching to available port ${PORT}."
fi

echo "Starting FastAPI server on http://127.0.0.1:${PORT}"
cd "$(dirname "$0")/../server"

if ! command -v python3 >/dev/null 2>&1; then
    echo "python3 is required but was not found in PATH."
    exit 1
fi

if [ ! -f "requirements.txt" ]; then
    echo "requirements.txt not found in $(pwd)"
    exit 1
fi

echo "Installing backend dependencies from requirements.txt..."
python3 -m pip install -r requirements.txt

python3 -m uvicorn app.main:app --reload --port "$PORT"
