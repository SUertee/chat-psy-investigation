#!/bin/bash

set -e

PORT=${1:-9000}

echo "Starting client on http://127.0.0.1:${PORT}"
cd "$(dirname "$0")/.."
python3 -m http.server "$PORT"
，
