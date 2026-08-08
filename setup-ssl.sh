#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
DOMAIN="${1:-HalalMuslimTravel.com}"; EMAIL="${2:-admin@${DOMAIN}}"
docker compose stop nginx 2>/dev/null || true
command -v certbot >/dev/null || { apt-get update -qq && apt-get install -y -qq certbot; }
certbot certonly --standalone -d "${DOMAIN}" -d "www.${DOMAIN}" --non-interactive --agree-tos --email "${EMAIL}"
mkdir -p nginx/certs
cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" nginx/certs/fullchain.pem
cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem"   nginx/certs/privkey.pem
docker compose up -d
echo "==> Real HTTPS live at https://${DOMAIN}/"
