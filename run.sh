#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
pip install -q -r requirements.txt 2>/dev/null || true
python db.py >/dev/null
PORT="${1:-8000}"
echo "==> http://localhost:${PORT}  (docs at /docs)"
python -m uvicorn app:app --host 0.0.0.0 --port "${PORT}"
