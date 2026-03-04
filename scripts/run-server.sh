#!/bin/bash

set -e

PORT=${1:-8001}

echo "Starting FastAPI server on http://127.0.0.1:${PORT}"
cd "$(dirname "$0")/../server"

if ! python3 -c "import uvicorn" >/dev/null 2>&1; then
    echo "Python module 'uvicorn' is not installed. Installing backend dependencies..."
    python3 -m pip install -r requirements.txt
fi

python3 -m uvicorn app.main:app --reload --port "$PORT"
