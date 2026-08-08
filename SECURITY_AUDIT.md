# 🔒 Security Audit — Jelajah Halal Portal

**Scope:** the full-stack portal code we built (`app.py`, `db.py`, `Dockerfile`,
`docker-compose.yml`, `nginx/nginx.conf`, `requirements.txt`, `.gitignore`).
**Method:** static analysis run live in the sandbox (grep pattern-matching, SQL call
tracing, config inspection, and validated remediation code). This is **not** a substitute
for a full pentest or a live CVE scan (no internet in the sandbox), but it covers the five
requested areas thoroughly.

> ⚠️ **Note on scope:** I audited the code **we** built together. Your local `mylinuxbsd`
> folder is on your own machine and was never uploaded, so it is **not** covered here.
> Upload it and I'll run the same audit on it.

## 📊 Summary scorecard

| # | Area | Rating | Headline |
|---|------|:------:|----------|
| 1 | Secrets hygiene | 🟢 **Good** | No hardcoded secrets; `.gitignore` covers certs/DB/`.env` |
| 2 | Injection | 🟢 **Good** (1 latent) | All user values parameterised; one f-string on *identifiers* to lock down |
| 3 | Web hardening | 🟡 **Needs work** | Good TLS + headers, but **PII endpoint unauthenticated**, no rate-limit, no CSP |
| 4 | Container safety | 🟢 **Good** | Non-root, internal-only app port, `:ro` mounts, healthcheck |
| 5 | Dependencies | 🟡 **Needs work** | Floating versions, `gunicorn` undeclared, no lockfile/CVE scan |

**Highest priority:** Finding **3a** — `GET /api/enquiries` returns submitted names, emails
and messages **with no authentication**.

---

## 1. 🔑 Secrets hygiene — 🟢 Good
**What I checked:** grepped all `.py/.yml/.sh/.conf` for `password|secret|api_key|token|
private_key|BEGIN RSA` etc., and verified `.gitignore` coverage.

- ✅ **No hardcoded secrets** anywhere in the source.
- ✅ `.gitignore` correctly excludes `*.pem`, `*.key`, `.env`, `portal.db`, `data/`.
- ✅ Earlier `git ls-files` confirmed **0** certs/keys/DB tracked in the repo.
- 🟢 Good practice already present: `db.py` reads `DB_PATH` from the environment.

**Recommendation:** When you add the admin key (Fix 1), keep it in `.env` only — which is
already git-ignored. Consider adding a pre-commit hook with `gitleaks` for defence-in-depth.

## 2. 💉 Injection — 🟢 Good, with one latent item
**What I checked:** traced every `conn.execute(...)` call and every caller of `fetch()`.

- ✅ **All user-supplied values are parameterised** with `?` placeholders — search, itineraries,
  enquiries, reviews. No f-strings/`%`/`+`/`.format()` on **values**. SQLi via inputs: not found.
- ✅ Pydantic models enforce type + length bounds on every POST body; `rating` bounded `1–5`;
  search `q` has `min_length=1`.
- 🟡 **Latent (LOW):** `app.py:31` builds `f"SELECT * FROM {table} ORDER BY {order}"`.
  Tracing all callers, `table`/`order` are **only ever hardcoded literals** (`"mosques"`,
  `"id DESC"`) — **not reachable by an attacker today**. But identifiers can't be
  parameterised, so if a future dev wires a request param into `fetch()`, it becomes
  injectable. → **Allow-list** table/column names (Fix 2, verified to block injection).

## 3. 🌐 Web hardening — 🟡 Needs work
**What I checked:** CORS, security headers, TLS/HTTPS, rate-limiting, endpoint auth.

**Good:**
- ✅ HTTP→HTTPS 301 redirect; TLS 1.2/1.3 only; `HIGH:!aNULL:!MD5` ciphers.
- ✅ Security headers present: `HSTS`, `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`.
- ✅ No over-permissive CORS (no `allow_origins=["*"]`) — fine for the same-origin proxy setup.

**Findings:**
- 🔴 **3a (HIGH) — Broken access control / PII exposure.** `GET /api/enquiries` returns all
  stored enquiries (name, email, message) with **no auth**. Anyone hitting the URL reads
  visitors' personal data → PDPA/GDPR problem. **→ Fix 1** (auth-gate or remove).
- 🟡 **3b (MEDIUM) — No rate limiting.** `POST /api/reviews` and `/api/enquiries` can be
  flooded (spam, storage-fill, review manipulation). **→ Fix 3** (nginx `limit_req`).
- 🟡 **3c (MEDIUM) — No Content-Security-Policy** (and no `Permissions-Policy`). Raises XSS
  blast-radius. **→ Fix 4.**
- ℹ️ **3d (LOW) — No authentication model at all** for write endpoints. Acceptable for a
  public prototype, but add auth before production if you don't want anonymous writes.

## 4. 🐳 Container safety — 🟢 Good
**What I checked:** user, exposed ports, healthcheck, image pinning, mount modes.

- ✅ **Runs as non-root** (`USER appuser`) — big one, done right.
- ✅ App port **8000 is internal only** (`expose:`), never published; only nginx binds 80/443.
- ✅ `HEALTHCHECK` defined; nginx config + certs mounted **read-only** (`:ro`).
- ✅ Production ASGI stack (gunicorn + uvicorn workers), not the dev server.
- 🟡 **4a (LOW):** base images pinned to **minor** tags (`python:3.12-slim`,
  `nginx:1.27-alpine`) — patch level floats between rebuilds. For fully reproducible builds,
  pin by `@sha256:` digest.
- 🟡 **4b (LOW):** consider adding `read_only: true` + `cap_drop: [ALL]` to the compose
  services for extra hardening.

## 5. 📦 Dependency risks — 🟡 Needs work
**What I checked:** `requirements.txt`, transitive/implicit deps, pinning, CVE tooling.

- 🟡 **5a (MEDIUM):** versions use **floating `>=`** (`fastapi>=0.100`, `uvicorn>=0.22`).
  Builds are **non-reproducible** and could silently pull a regressed/vulnerable release.
  **→ pin with `==`** (Fix 5).
- 🟡 **5b (MEDIUM):** `gunicorn` is installed in the Dockerfile but **not declared** in
  `requirements.txt` — undeclared runtime dep. Add it.
- 🟡 **5c:** `pydantic`/`starlette` come in transitively, unpinned. A lockfile
  (`pip freeze > requirements.lock`) fixes the whole tree.
- ℹ️ **5d:** I could not run a live CVE scan (`pip-audit`/`safety`) — no internet in the
  sandbox. **Action for you:** run `pip-audit -r requirements.txt` on a networked machine,
  and add it to CI (snippet in Fix 5).

---

## ✅ Prioritised action list
1. **[HIGH]** Auth-gate or remove `GET /api/enquiries` (stop PII leak). — *Fix 1*
2. **[MED]** Add nginx rate-limiting on `/api/`. — *Fix 3*
3. **[MED]** Pin dependencies + declare `gunicorn` + add `pip-audit` to CI. — *Fix 5*
4. **[MED]** Add `Content-Security-Policy` / `Permissions-Policy`. — *Fix 4*
5. **[LOW]** Allow-list `table`/`order` in `fetch()`. — *Fix 2*
6. **[LOW]** Pin base images by digest; add `cap_drop: [ALL]`.

All copy-paste fixes (and validated injection-blocking code) are in **`SECURITY_FIXES.md`**.

---
*Audit performed via live static analysis in the sandbox. For production sign-off, also run:
a networked `pip-audit`/`trivy image` scan, and a dynamic test (OWASP ZAP) against a staging
deployment.*
