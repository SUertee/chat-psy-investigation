#!/bin/bash

set -euo pipefail

PORT=${1:-8001}

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
