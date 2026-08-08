# 🔧 Security Remediation — copy-paste fixes

Concrete patches for the findings in the audit, highest-priority first.

---

## FIX 1 (HIGH) — Protect the enquiries endpoint (PII exposure)
`GET /api/enquiries` currently returns everyone's name, email and message with **no auth**.
Either remove it, or gate it behind an admin API key.

```python
# app.py — add near the top
import os, secrets
from fastapi import Header

ADMIN_API_KEY = os.environ["ADMIN_API_KEY"]   # set via env / .env, never hardcode

def require_admin(x_api_key: str = Header(...)):
    if not secrets.compare_digest(x_api_key, ADMIN_API_KEY):
        raise HTTPException(status_code=401, detail="Unauthorized")

# protect the read of submitted PII
@app.get("/api/enquiries", dependencies=[Depends(require_admin)])
def list_enquiries():
    return fetch("enquiries", "id DESC")
```
Add `from fastapi import Depends` to the imports. Set `ADMIN_API_KEY` in your `.env`
(already git-ignored). Do the same for any other endpoint that returns stored user data.

---

## FIX 2 (LOW/latent) — Allow-list the dynamic table/order in `fetch()`
`f"SELECT * FROM {table} ORDER BY {order}"` is safe **today** (only called with literals),
but identifiers can't be parameterised, so lock it down to prevent future misuse.

```python
_ALLOWED_TABLES = {"mosques","food","venues","attractions","medical","hotels",
                   "transport","apps","practical","reviews","enquiries"}
_ALLOWED_ORDER = {"id","id DESC","city","name"}

def fetch(table, order="id"):
    if table not in _ALLOWED_TABLES or order not in _ALLOWED_ORDER:
        raise ValueError("Illegal table/order")           # fail closed
    conn = db.get_conn()
    rows = [enrich(dict(r)) for r in conn.execute(f"SELECT * FROM {table} ORDER BY {order}")]
    conn.close()
    return rows
```

---

## FIX 3 (MEDIUM) — Rate-limit the public POST endpoints
Stops spam/abuse of `/api/reviews` and `/api/enquiries`. Add in nginx (no code change):

```nginx
# in nginx.conf, http{} or top of server{}
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/m;

# inside the HTTPS server{} block, wrap the API:
location /api/ {
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://web:8000;
    # ...keep existing proxy_set_header lines...
}
```

---

## FIX 4 (MEDIUM) — Add a Content-Security-Policy header
Add to the HTTPS `server{}` block in `nginx.conf`:

```nginx
add_header Content-Security-Policy
  "default-src 'self'; img-src 'self' https://*.tile.openstreetmap.org data:; \
   style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; \
   script-src 'self' https://unpkg.com; \
   font-src 'self' https://fonts.gstatic.com; \
   connect-src 'self'" always;
add_header Permissions-Policy "geolocation=(self), microphone=(), camera=()" always;
```
(Adjust the allow-listed CDNs to match what `index.html` actually loads.)

---

## FIX 5 (MEDIUM) — Pin dependencies + declare gunicorn
Reproducible, auditable builds.

```text
# requirements.txt  (example pins — run `pip freeze` to capture your exact tested set)
fastapi==0.115.6
uvicorn[standard]==0.34.0
gunicorn==23.0.0
pydantic==2.10.4
```
Then add a CVE scan to CI (`.github/workflows/deploy.yml`):
```yaml
      - name: Dependency vulnerability scan
        run: |
          pip install pip-audit
          pip-audit -r requirements.txt
```
Optionally pin base images by digest in the Dockerfile:
`FROM python:3.12-slim@sha256:<digest>`.
