# 🕌 Jelajah Halal — Malaysia Muslim-Friendly Tourism Portal

Full-stack web app (FastAPI + SQLite) with a live REST API and responsive front-end.
**Security-hardened build** — see `SECURITY_AUDIT.md` for the audit and applied fixes.

## Run locally
```bash
bash run.sh            # http://localhost:8000  (API docs at /docs)
```

## Deploy (Debian + Docker)
```bash
./deploy.sh docker HalalMuslimTravel.com     # app + nginx + self-signed HTTPS
sudo ./setup-ssl.sh HalalMuslimTravel.com you@email.com   # real Let's Encrypt cert
```

## Features
Mosques · Halal food · Attractions · Live prayer times & Qibla · Interactive map ·
Search · Saveable itineraries · Reviews · Enquiry form · Dark mode · 4 languages.

## Security hardening applied
- SQL identifier allow-list in `fetch()`
- Admin-key gate on `GET /api/enquiries` (set `ADMIN_API_KEY` in `.env`)
- nginx rate-limiting on `/api/`, CSP + security headers
- Pinned dependencies, non-root container, `pip-audit` in CI

## Structure
```
app.py db.py prayer.py seed_data.py   # backend
templates/ static/                    # frontend
Dockerfile docker-compose.yml nginx/  # deploy
deploy.sh setup-ssl.sh run.sh         # scripts
.github/workflows/deploy.yml          # CI/CD
SECURITY_AUDIT.md SECURITY_FIXES.md   # security docs
```
