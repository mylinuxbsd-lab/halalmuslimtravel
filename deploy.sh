#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
MODE="${1:-docker}"; DOMAIN="${2:-localhost}"
gen(){ mkdir -p nginx/certs; [ -f nginx/certs/fullchain.pem ] || openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout nginx/certs/privkey.pem -out nginx/certs/fullchain.pem -subj "/CN=${DOMAIN}" 2>/dev/null; }
case "$MODE" in
  docker)
    command -v docker >/dev/null || { echo "Install Docker first: curl -fsSL https://get.docker.com | sh"; exit 1; }
    sed -i.bak "s/YOUR_DOMAIN/${DOMAIN}/g" nginx/nginx.conf && rm -f nginx/nginx.conf.bak
    gen; mkdir -p data
    docker compose up -d --build; sleep 6; docker compose ps
    echo "==> https://${DOMAIN}/  (self-signed until you run ./setup-ssl.sh)";;
  local)
    pip install -q -r requirements.txt 2>/dev/null || true
    python db.py >/dev/null
    exec python -m uvicorn app:app --host 0.0.0.0 --port 8000;;
  *) echo "Usage: ./deploy.sh docker DOMAIN | local"; exit 1;;
esac
