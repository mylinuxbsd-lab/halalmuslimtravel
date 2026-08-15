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
A hash-routed single-page app (Home / Explore / Plan a Trip / Prayer & Qibla / Map / Travel Info)
over a unified `/api/places` search-and-filter endpoint spanning mosques, attractions (Places to
Visit, Shopping Malls, Theme Parks, For Children, Outdoor Adventures, Beaches & Islands, Night
Markets, Day Trips), halal food, local fruits, healthcare and stays — 13 categories across all 14
Malaysian states/territories. Real photo thumbnails (Wikipedia, individually verified to resolve
and to actually match the place before being stored — never a guessed URL). A conversational trip
planner (1 Day → 1 Month, tuned per travel-party type) that only ever recommends real catalogue
entries. Saveable favourites and itineraries, reviews, an interactive Leaflet map, a curated list
of foreign YouTubers covering Malaysia, live prayer times & Qibla, dark mode, 4 languages, and an
installable offline-capable PWA (manifest + service worker).

Dataset sourced from "Places to visit in Malaysia updated Aug 2026.xlsx", broadened with
additional states/regions and local fruits.

## Security hardening applied
- SQL identifier allow-list in `fetch()`
- Admin-key gate on `GET /api/enquiries` (set `ADMIN_API_KEY` in `.env`)
- nginx rate-limiting on `/api/`, CSP + security headers
- Pinned dependencies, non-root container, `pip-audit` in CI

## Structure
```
app.py db.py prayer.py seed_data.py           # backend
templates/ static/                            # frontend (static/manifest.json + sw.js = PWA)
Dockerfile docker-compose*.yml nginx/         # deploy (dev = self-signed, prod = shared-host edge router)
deploy.sh setup-ssl.sh run.sh                 # scripts
.github/workflows/deploy.yml                  # CI/CD
SECURITY_AUDIT.md SECURITY_FIXES.md           # security docs
```
