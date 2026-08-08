"""
Malaysia Muslim-Friendly Tourism Portal - Full-stack FastAPI backend.
Run:  python -m uvicorn app:app --host 0.0.0.0 --port 8000
Docs: http://localhost:8000/docs

Security-hardened build:
- SQL identifier allow-list in fetch()
- Admin API key gate on PII endpoints (set ADMIN_API_KEY env var)
"""
import os
import json
import secrets
import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Header, Depends
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import db
import prayer
import seed_data as S

BASE = os.path.dirname(__file__)
db.init_db()

app = FastAPI(title="Jelajah Halal API",
              description="Backend for the Malaysia Muslim-Friendly Tourism Portal.",
              version="1.0.0")

# ---- Admin auth for endpoints that expose stored user data (PII) ----
ADMIN_API_KEY = os.environ.get("ADMIN_API_KEY")  # set in .env; if unset, PII reads are disabled

def require_admin(x_api_key: str = Header(default="")):
    if not ADMIN_API_KEY or not secrets.compare_digest(x_api_key, ADMIN_API_KEY):
        raise HTTPException(status_code=401, detail="Unauthorized")

# ---- SQL identifier allow-lists (identifiers can't be parameterised) ----
_ALLOWED_TABLES = {"mosques", "food", "venues", "attractions", "medical", "hotels",
                   "transport", "apps", "practical", "reviews", "enquiries"}
_ALLOWED_ORDER = {"id", "id DESC", "city", "name"}


def enrich(row: dict):
    if "lat" in row and "lng" in row and row["lat"] is not None:
        row["distance"] = db.dist_label(row["lat"], row["lng"])
        row["distance_km"] = round(db.dist_km(row["lat"], row["lng"]), 1)
        row["maps_url"] = f"https://www.google.com/maps/dir/?api=1&destination={row['lat']},{row['lng']}"
    return row


def fetch(table, order="id"):
    if table not in _ALLOWED_TABLES or order not in _ALLOWED_ORDER:
        raise ValueError("Illegal table/order")
    conn = db.get_conn()
    rows = [enrich(dict(r)) for r in conn.execute(f"SELECT * FROM {table} ORDER BY {order}")]
    conn.close()
    return rows


# ---------- catalogue endpoints ----------
@app.get("/api/mosques")
def mosques():
    return fetch("mosques", "city")


@app.get("/api/food")
def food():
    conn = db.get_conn()
    dishes = [dict(r) for r in conn.execute("SELECT * FROM food")]
    venues = [enrich(dict(r)) for r in conn.execute("SELECT * FROM venues")]
    conn.close()
    return {"dishes": dishes, "venues": venues}


@app.get("/api/attractions")
def attractions(group: Optional[str] = None):
    conn = db.get_conn()
    if group and group != "All":
        rows = conn.execute("SELECT * FROM attractions WHERE grp=?", (group,))
    else:
        rows = conn.execute("SELECT * FROM attractions")
    out = [enrich(dict(r)) for r in rows]
    conn.close()
    return out


@app.get("/api/medical")
def medical():
    return fetch("medical")


@app.get("/api/hotels")
def hotels():
    rows = fetch("hotels")
    for r in rows:
        r["perks"] = r["perks"].split("|")
    return rows


@app.get("/api/transport")
def transport():
    return fetch("transport")


@app.get("/api/apps")
def apps():
    grouped = {}
    for r in fetch("apps"):
        grouped.setdefault(r["category"], []).append(r["name"])
    return grouped


@app.get("/api/practical")
def practical():
    return fetch("practical")


# ---------- prayer & qibla ----------
CITY_COORDS = {m[1]: (m[2], m[3]) for m in S.MOSQUES}


@app.get("/api/prayer-times")
def prayer_times(city: str = "Kuala Lumpur", date: Optional[str] = None):
    if city not in CITY_COORDS:
        raise HTTPException(404, f"Unknown city '{city}'.")
    lat, lng = CITY_COORDS[city]
    d = datetime.date.today()
    if date:
        try:
            d = datetime.date.fromisoformat(date)
        except ValueError:
            raise HTTPException(400, "date must be YYYY-MM-DD")
    return {"city": city, "date": d.isoformat(),
            "method": "JAKIM (Fajr 20\u00b0, Isha 18\u00b0)",
            "times": prayer.prayer_times(lat, lng, d)}


@app.get("/api/qibla")
def qibla(city: str = "Kuala Lumpur"):
    if city not in CITY_COORDS:
        raise HTTPException(404, f"Unknown city '{city}'.")
    lat, lng = CITY_COORDS[city]
    return {"city": city, "bearing": round(prayer.qibla_bearing(lat, lng), 1)}


@app.get("/api/cities")
def cities():
    return sorted(CITY_COORDS.keys())


# ---------- search ----------
@app.get("/api/search")
def search(q: str = Query(..., min_length=1, max_length=80)):
    ql = f"%{q.lower()}%"
    conn = db.get_conn()
    results = []
    q_tables = [
        ("mosque", "SELECT name, city FROM mosques WHERE lower(name) LIKE ? OR lower(city) LIKE ?"),
        ("dish", "SELECT name, tag FROM food WHERE lower(name) LIKE ? OR lower(tag) LIKE ?"),
        ("venue", "SELECT name, type FROM venues WHERE lower(name) LIKE ? OR lower(type) LIKE ?"),
        ("attraction", "SELECT name, grp FROM attractions WHERE lower(name) LIKE ? OR lower(grp) LIKE ?"),
        ("hospital", "SELECT name, specialty FROM medical WHERE lower(name) LIKE ? OR lower(specialty) LIKE ?"),
        ("hotel", "SELECT name, perks FROM hotels WHERE lower(name) LIKE ? OR lower(perks) LIKE ?"),
    ]
    for kind, sql in q_tables:
        for r in conn.execute(sql, (ql, ql)):
            d = dict(r)
            results.append({"type": kind, "name": d["name"], "detail": list(d.values())[1]})
    conn.close()
    return {"query": q, "count": len(results), "results": results}


# ---------- prebuilt itineraries ----------
@app.get("/api/itineraries/prebuilt")
def prebuilt(days: str = "3"):
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT day_no, title, items FROM prebuilt_itineraries WHERE days=? ORDER BY day_no",
        (days,)).fetchall()
    conn.close()
    if not rows:
        raise HTTPException(404, "No such plan. Try 3, 5 or 7.")
    return [{"day": r["day_no"], "title": r["title"], "items": json.loads(r["items"])} for r in rows]


# ---------- saved (custom) itineraries ----------
class ItineraryIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    items: list[str] = Field(..., min_items=1, max_items=50)


@app.post("/api/itineraries")
def save_itinerary(payload: ItineraryIn):
    conn = db.get_conn()
    cur = conn.execute("INSERT INTO saved_itineraries(name, items) VALUES(?,?)",
                       (payload.name, json.dumps(payload.items)))
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return {"id": new_id, "message": "Itinerary saved.", "share_url": f"/api/itineraries/{new_id}"}


@app.get("/api/itineraries")
def list_itineraries():
    conn = db.get_conn()
    rows = conn.execute("SELECT id, name, items, created_at FROM saved_itineraries ORDER BY id DESC").fetchall()
    conn.close()
    return [{"id": r["id"], "name": r["name"], "items": json.loads(r["items"]),
             "created_at": r["created_at"]} for r in rows]


@app.get("/api/itineraries/{iid}")
def get_itinerary(iid: int):
    conn = db.get_conn()
    r = conn.execute("SELECT id, name, items, created_at FROM saved_itineraries WHERE id=?", (iid,)).fetchone()
    conn.close()
    if not r:
        raise HTTPException(404, "Itinerary not found.")
    return {"id": r["id"], "name": r["name"], "items": json.loads(r["items"]), "created_at": r["created_at"]}


@app.delete("/api/itineraries/{iid}")
def delete_itinerary(iid: int):
    conn = db.get_conn()
    conn.execute("DELETE FROM saved_itineraries WHERE id=?", (iid,))
    conn.commit()
    conn.close()
    return {"message": "deleted"}


# ---------- enquiries (write is public; READ is admin-gated: contains PII) ----------
class EnquiryIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: str = Field(..., min_length=3, max_length=200)
    subject: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1, max_length=2000)


@app.post("/api/enquiries")
def create_enquiry(payload: EnquiryIn):
    conn = db.get_conn()
    cur = conn.execute("INSERT INTO enquiries(name,email,subject,message) VALUES(?,?,?,?)",
                       (payload.name, payload.email, payload.subject, payload.message))
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return {"id": new_id, "message": "Thank you! Your enquiry has been received."}


@app.get("/api/enquiries", dependencies=[Depends(require_admin)])
def list_enquiries():
    return fetch("enquiries", "id DESC")


# ---------- reviews ----------
class ReviewIn(BaseModel):
    place: str = Field(..., min_length=1, max_length=160)
    author: str = Field(..., min_length=1, max_length=120)
    rating: int = Field(..., ge=1, le=5)
    comment: str = Field(..., min_length=1, max_length=800)


@app.post("/api/reviews")
def create_review(payload: ReviewIn):
    conn = db.get_conn()
    cur = conn.execute("INSERT INTO reviews(place,author,rating,comment) VALUES(?,?,?,?)",
                       (payload.place, payload.author, payload.rating, payload.comment))
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return {"id": new_id, "message": "Review posted."}


@app.get("/api/reviews")
def list_reviews():
    return fetch("reviews", "id DESC")


@app.get("/api/stats")
def stats():
    conn = db.get_conn()
    def n(t): return conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    out = {t: n(t) for t in ["mosques", "attractions", "medical", "hotels",
                             "saved_itineraries", "enquiries", "reviews"]}
    conn.close()
    return out


# ---------- static frontend ----------
@app.get("/")
def index():
    return FileResponse(os.path.join(BASE, "templates", "index.html"))


app.mount("/static", StaticFiles(directory=os.path.join(BASE, "static")), name="static")
