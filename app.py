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
import urllib.parse
import urllib.request
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Header, Depends
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import db
import prayer
import seed_data as S

BASE = os.path.dirname(__file__)
db.init_db()

app = FastAPI(title="Jelajah Halal API",
              description="Backend for the Malaysia Muslim-Friendly Tourism Portal.",
              version="2.0.0")

# ---- Admin auth for endpoints that expose stored user data (PII) ----
ADMIN_API_KEY = os.environ.get("ADMIN_API_KEY")  # set in .env; if unset, PII reads are disabled

def require_admin(x_api_key: str = Header(default="")):
    if not ADMIN_API_KEY or not secrets.compare_digest(x_api_key, ADMIN_API_KEY):
        raise HTTPException(status_code=401, detail="Unauthorized")

# ---- SQL identifier allow-lists (identifiers can't be parameterised) ----
_ALLOWED_TABLES = {"mosques", "attractions", "food", "fruits", "cartoons", "youtubers", "medical", "accommodation",
                   "transport", "apps", "practical", "reviews", "enquiries"}
_ALLOWED_ORDER = {"id", "id DESC", "name"}


def fetch(table, order="id"):
    if table not in _ALLOWED_TABLES or order not in _ALLOWED_ORDER:
        raise ValueError("Illegal table/order")
    conn = db.get_conn()
    rows = [dict(r) for r in conn.execute(f"SELECT * FROM {table} ORDER BY {order}")]
    conn.close()
    return rows


# ---------- unified place browsing ----------
# One shape across every catalogue table so the front-end can search, filter and
# paginate all destinations together instead of dumping each table in full.
_PLACES_UNION = """
SELECT 'mosque' AS kind, id, name, 'Mosques & Islamic Sites' AS category, '' AS subcategory,
       description, state, distance, travel_time, photo_url AS website, maps_url,
       photo_thumb AS thumb, lat, lng, 0 AS featured,
       NULL AS photo_ref, NULL AS photo_attrib FROM mosques
UNION ALL
SELECT 'attraction', id, name, category, '', description, state, distance, travel_time,
       photo_url, maps_url, photo_thumb, lat, lng, 0, photo_ref, photo_attrib FROM attractions
UNION ALL
SELECT 'food', id, name, 'Food & Dining', '', description, '', '', '',
       photo_url, '', photo_thumb, NULL, NULL, 0, NULL, NULL FROM food
UNION ALL
SELECT 'fruit', id, name, 'Local Fruits', '', description, '', '', '',
       photo_url, '', photo_thumb, NULL, NULL, 0, NULL, NULL FROM fruits
UNION ALL
SELECT 'medical', id, name, 'Healthcare', specialties, description, state, distance, travel_time,
       website, maps_url, NULL, lat, lng, 0, NULL, NULL FROM medical
UNION ALL
SELECT 'stay', id, name, 'Stays', category, description, state, distance, '',
       website, maps_url, NULL, lat, lng, featured, NULL, NULL FROM accommodation
"""

# "12 km" / "1,600 km" -> 12.0 / 1600.0 ; blank distances sort last rather than first.
_DIST_EXPR = "CAST(REPLACE(distance, ',', '') AS REAL)"
# Featured entries (currently: Tabung Haji Hotel, PNB Perdana Hotel) always float
# to the top of any sort, within whatever filter is active.
_FEATURED_FIRST = "CASE WHEN featured = 1 THEN 0 ELSE 1 END, "
_SORTS = {
    "name": _FEATURED_FIRST + "name COLLATE NOCASE ASC",
    "distance": _FEATURED_FIRST + f"CASE WHEN distance IS NULL OR distance = '' THEN 1 ELSE 0 END, {_DIST_EXPR} ASC, name COLLATE NOCASE",
    "photo": _FEATURED_FIRST + "CASE WHEN thumb IS NULL OR thumb = '' THEN 1 ELSE 0 END, name COLLATE NOCASE",
}


@app.get("/api/places")
def places(q: Optional[str] = Query(None, max_length=80),
           category: Optional[str] = None,
           state: Optional[str] = None,
           sort: str = "name",
           limit: int = Query(24, ge=1, le=100),
           offset: int = Query(0, ge=0)):
    if sort not in _SORTS:
        raise HTTPException(400, "sort must be one of: name, distance, photo")
    where, params = [], []
    if q:
        where.append("(lower(name) LIKE ? OR lower(description) LIKE ? OR lower(state) LIKE ? OR lower(category) LIKE ?)")
        params += [f"%{q.lower()}%"] * 4
    if category and category != "All":
        where.append("category = ?")
        params.append(category)
    if state and state != "All":
        where.append("state = ?")
        params.append(state)
    clause = (" WHERE " + " AND ".join(where)) if where else ""

    conn = db.get_conn()
    total = conn.execute(f"SELECT COUNT(*) FROM ({_PLACES_UNION}){clause}", params).fetchone()[0]
    rows = conn.execute(
        f"SELECT * FROM ({_PLACES_UNION}){clause} ORDER BY {_SORTS[sort]} LIMIT ? OFFSET ?",
        params + [limit, offset]).fetchall()
    conn.close()
    return {"total": total, "limit": limit, "offset": offset,
            "items": [dict(r) for r in rows]}


@app.get("/api/places/filters")
def place_filters():
    """Categories and states with counts, for building the browse filters."""
    conn = db.get_conn()
    cats = conn.execute(
        f"SELECT category, COUNT(*) n FROM ({_PLACES_UNION}) GROUP BY category ORDER BY category").fetchall()
    states = conn.execute(
        f"SELECT state, COUNT(*) n FROM ({_PLACES_UNION}) WHERE state <> '' GROUP BY state ORDER BY state").fetchall()
    conn.close()
    return {"categories": [{"name": r["category"], "count": r["n"]} for r in cats],
            "states": [{"name": r["state"], "count": r["n"]} for r in states]}


_GOOGLE_MAPS_KEY = os.environ.get("GOOGLE_MAPS_KEY", "").strip()
_photo_cache: dict[int, tuple[bytes, str]] = {}


@app.get("/api/place-photo/{pid}")
def place_photo(pid: int, w: int = Query(400, ge=80, le=1200)):
    """Stream a Google Places photo for an attraction.

    The image is fetched server-side and proxied so the API key is never
    exposed to the browser (a redirect would leak it in the Location header).
    Google's attribution travels with the place row and is rendered on the card.
    """
    if not _GOOGLE_MAPS_KEY:
        raise HTTPException(503, "Place photos are not configured.")

    cached = _photo_cache.get(pid)
    if cached:
        body, ctype = cached
        return Response(body, media_type=ctype, headers={"Cache-Control": "public, max-age=86400"})

    conn = db.get_conn()
    row = conn.execute("SELECT photo_ref FROM attractions WHERE id = ?", (pid,)).fetchone()
    conn.close()
    if not row or not row["photo_ref"]:
        raise HTTPException(404, "No photo for this place.")

    url = (f"https://places.googleapis.com/v1/{row['photo_ref']}/media"
           f"?maxWidthPx={w}&key={urllib.parse.quote(_GOOGLE_MAPS_KEY)}")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "JelajahHalal/1.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            body = r.read()
            ctype = r.headers.get("Content-Type", "image/jpeg")
    except Exception:
        raise HTTPException(502, "Could not fetch the photo.")

    if len(_photo_cache) < 500:
        _photo_cache[pid] = (body, ctype)
    return Response(body, media_type=ctype, headers={"Cache-Control": "public, max-age=86400"})


@app.get("/api/places/{kind}/{pid}")
def place_detail(kind: str, pid: int):
    conn = db.get_conn()
    row = conn.execute(f"SELECT * FROM ({_PLACES_UNION}) WHERE kind = ? AND id = ?", (kind, pid)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Place not found.")
    place = dict(row)
    reviews = conn.execute(
        "SELECT author, rating, comment, created_at FROM reviews WHERE place = ? ORDER BY id DESC",
        (place["name"],)).fetchall()
    conn.close()
    place["reviews"] = [dict(r) for r in reviews]
    return place


# ---------- catalogue endpoints ----------
@app.get("/api/mosques")
def mosques():
    return fetch("mosques", "name")


@app.get("/api/attractions")
def attractions(category: Optional[str] = None):
    conn = db.get_conn()
    if category and category != "All":
        rows = conn.execute("SELECT * FROM attractions WHERE category=? ORDER BY name", (category,))
    else:
        rows = conn.execute("SELECT * FROM attractions ORDER BY name")
    out = [dict(r) for r in rows]
    conn.close()
    return out


@app.get("/api/attractions/categories")
def attraction_categories():
    conn = db.get_conn()
    rows = conn.execute("SELECT DISTINCT category FROM attractions ORDER BY category").fetchall()
    conn.close()
    return [r["category"] for r in rows]


@app.get("/api/food")
def food():
    return fetch("food", "name")


@app.get("/api/fruits")
def fruits():
    return fetch("fruits", "name")


@app.get("/api/cartoons")
def cartoons():
    return fetch("cartoons", "name")


@app.get("/api/youtubers")
def youtubers():
    return fetch("youtubers", "name")


@app.get("/api/medical")
def medical():
    return fetch("medical", "name")


@app.get("/api/accommodation")
def accommodation():
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT * FROM accommodation ORDER BY CASE WHEN featured=1 THEN 0 ELSE 1 END, name COLLATE NOCASE").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/api/transport")
def transport():
    return fetch("transport", "id")


@app.get("/api/apps")
def apps():
    return fetch("apps", "id")


@app.get("/api/practical")
def practical():
    return fetch("practical", "id")


# ---------- prayer & qibla ----------
@app.get("/api/prayer-times")
def prayer_times(city: str = "Kuala Lumpur", date: Optional[str] = None):
    if city not in S.CITY_COORDS:
        raise HTTPException(404, f"Unknown city '{city}'.")
    lat, lng = S.CITY_COORDS[city]
    d = datetime.date.today()
    if date:
        try:
            d = datetime.date.fromisoformat(date)
        except ValueError:
            raise HTTPException(400, "date must be YYYY-MM-DD")
    return {"city": city, "date": d.isoformat(),
            "method": "JAKIM (Fajr 20°, Isha 18°)",
            "times": prayer.prayer_times(lat, lng, d)}


@app.get("/api/qibla")
def qibla(city: str = "Kuala Lumpur"):
    if city not in S.CITY_COORDS:
        raise HTTPException(404, f"Unknown city '{city}'.")
    lat, lng = S.CITY_COORDS[city]
    return {"city": city, "bearing": round(prayer.qibla_bearing(lat, lng), 1)}


@app.get("/api/cities")
def cities():
    return sorted(S.CITY_COORDS.keys())


# ---------- prebuilt itineraries ----------
_DURATION_CUTOFF = {"1 Week": 7, "2 Weeks": 14, "3 Weeks": 21, "1 Month": 30}


@app.get("/api/itineraries/prebuilt")
def prebuilt(duration: str = "1 Week"):
    cutoff = _DURATION_CUTOFF.get(duration)
    if cutoff is None:
        raise HTTPException(404, "No such plan. Try '1 Week', '2 Weeks', '3 Weeks' or '1 Month'.")
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT day_no, activity, location, type, why, tips FROM itinerary_items WHERE day_no<=? ORDER BY day_no, id",
        (cutoff,)).fetchall()
    conn.close()
    days = {}
    for r in rows:
        days.setdefault(r["day_no"], []).append({
            "activity": r["activity"], "location": r["location"], "type": r["type"],
            "why": r["why"], "tips": r["tips"],
        })
    return [{"day": day_no, "items": items} for day_no, items in sorted(days.items())]


# ---------- trip-planner assistant ----------
# Builds a day-by-day plan from the real catalogue. Everything it suggests is a
# row in the database, so the planner can never invent a place that isn't there.
_TRIP_DAYS = {"1 Day": 1, "3 Days": 3, "1 Week": 7, "2 Weeks": 14, "3 Weeks": 21, "1 Month": 30}

_REGIONS = {
    "Kuala Lumpur & Klang Valley": ["Kuala Lumpur", "Selangor", "Putrajaya"],
    "Melaka & Negeri Sembilan": ["Melaka", "Negeri Sembilan"],
    "Highlands & Pahang": ["Pahang"],
    "Northern Peninsula": ["Penang", "Perak", "Kedah", "Perlis"],
    "Johor": ["Johor"],
    "East Coast": ["Terengganu", "Kelantan"],
    "Borneo": ["Sabah", "Sarawak", "Labuan"],
}
_LEG_WEIGHT = {"Kuala Lumpur & Klang Valley": 5, "Melaka & Negeri Sembilan": 1,
               "Highlands & Pahang": 1, "Northern Peninsula": 2,
               "Johor": 1, "East Coast": 1.5, "Borneo": 2.5}

# per_day = sights per day (excluding the daily food pick); weights bias the ranking.
_PARTY = {
    "couple": {"label": "a couple", "per_day": 4, "max_km": 9999,
               "w": {"Places to Visit": 1.5, "Food & Dining": 1.4, "Beaches & Islands": 1.4,
                     "Night Markets & Entertainment": 1.3, "Mosques & Islamic Sites": 1.1,
                     "For Children": .3, "Theme Parks (Outside KL)": .7},
               "tips": ["Sunset at a rooftop or lakeside mosque is the highlight of most KL evenings.",
                        "Night markets are at their best after 7pm — go hungry."]},
    "family_young": {"label": "a family with young children", "per_day": 3, "max_km": 200,
                     "w": {"For Children": 2.0, "Theme Parks (Outside KL)": 1.5, "Places to Visit": 1.0,
                           "Food & Dining": 1.2, "Mosques & Islamic Sites": 1.0,
                           "Outdoor Adventures": .5, "Night Markets & Entertainment": .6},
                     "tips": ["Plan indoor attractions for 12–4pm — that's the hottest part of the day.",
                              "Every mall has a surau (prayer room) and baby-changing facilities.",
                              "Strollers are fine in malls and KLCC park, harder on older heritage streets."]},
    "family_teens": {"label": "a family with teenagers", "per_day": 4, "max_km": 9999,
                     "w": {"Theme Parks (Outside KL)": 1.9, "Outdoor Adventures": 1.6,
                           "Night Markets & Entertainment": 1.4, "Shopping Malls": 1.3,
                           "Beaches & Islands": 1.3, "Places to Visit": 1.0, "For Children": .5},
                     "tips": ["Book theme-park tickets online — it's cheaper and skips the queue.",
                              "Teens usually rate the night markets and street food highest."]},
    "family_elderly": {"label": "a family with elderly parents", "per_day": 2, "max_km": 120,
                       "w": {"Mosques & Islamic Sites": 1.9, "Places to Visit": 1.4, "Food & Dining": 1.3,
                             "Healthcare": 1.1, "Shopping Malls": 1.0,
                             "Outdoor Adventures": .2, "Theme Parks (Outside KL)": .2,
                             "For Children": .4, "Beaches & Islands": .7},
                       "tips": ["Days are deliberately light — two stops, with a long midday rest.",
                                "Most major mosques and malls are step-free and have wheelchair access.",
                                "Grab (ride-hailing) door-to-door beats public transport for mobility."]},
    "solo": {"label": "a solo traveller", "per_day": 4, "max_km": 9999,
             "w": {"Places to Visit": 1.4, "Food & Dining": 1.3, "Outdoor Adventures": 1.2,
                   "Mosques & Islamic Sites": 1.2, "For Children": .2},
             "tips": ["Public transport (MRT/LRT) covers most of KL and is easy to navigate alone."]},
    "friends": {"label": "a group of friends", "per_day": 4, "max_km": 9999,
                "w": {"Outdoor Adventures": 1.5, "Night Markets & Entertainment": 1.4,
                      "Theme Parks (Outside KL)": 1.4, "Beaches & Islands": 1.3, "For Children": .2},
                "tips": ["Grab splits fares well for groups of 4+; consider a 6-seater for luggage."]},
}

_INTEREST_CATS = {
    "mosques": ["Mosques & Islamic Sites"], "food": ["Food & Dining", "Local Fruits"],
    "nature": ["Outdoor Adventures", "Beaches & Islands"], "shopping": ["Shopping Malls"],
    "theme_parks": ["Theme Parks (Outside KL)"], "beaches": ["Beaches & Islands"],
    "heritage": ["Places to Visit"], "kids": ["For Children"],
    "nightlife": ["Night Markets & Entertainment"],
}


class TripRequest(BaseModel):
    duration: str = Field("1 Week")
    party: str = Field("couple")
    pax: int = Field(2, ge=1, le=30)
    interests: list[str] = Field(default_factory=list, max_items=12)


def _km(text):
    try:
        return float(str(text).replace(",", "").split("km")[0].strip())
    except Exception:
        return 9999.0


def _allocate_legs(days):
    if days <= 3:
        names = ["Kuala Lumpur & Klang Valley"]
    elif days <= 7:
        names = ["Kuala Lumpur & Klang Valley", "Melaka & Negeri Sembilan", "Highlands & Pahang"]
    elif days <= 14:
        names = ["Kuala Lumpur & Klang Valley", "Melaka & Negeri Sembilan",
                 "Highlands & Pahang", "Northern Peninsula"]
    elif days <= 21:
        names = ["Kuala Lumpur & Klang Valley", "Melaka & Negeri Sembilan", "Highlands & Pahang",
                 "Northern Peninsula", "Johor", "East Coast"]
    else:
        names = list(_REGIONS)
    total = sum(_LEG_WEIGHT[n] for n in names)
    legs = [[n, max(1, round(days * _LEG_WEIGHT[n] / total))] for n in names]
    while sum(d for _, d in legs) > days:          # trim from the smallest legs first
        legs.sort(key=lambda x: -x[1]); legs[-1][1] -= 1
        legs = [l for l in legs if l[1] > 0]
    while sum(d for _, d in legs) < days:
        legs.sort(key=lambda x: -_LEG_WEIGHT[x[0]]); legs[0][1] += 1
    order = list(names)
    legs.sort(key=lambda x: order.index(x[0]))
    return legs


@app.post("/api/itinerary/generate")
def generate_itinerary(req: TripRequest):
    days_total = _TRIP_DAYS.get(req.duration)
    if not days_total:
        raise HTTPException(400, f"duration must be one of: {', '.join(_TRIP_DAYS)}")
    profile = _PARTY.get(req.party)
    if not profile:
        raise HTTPException(400, f"party must be one of: {', '.join(_PARTY)}")

    boost = set()
    for i in req.interests:
        boost.update(_INTEREST_CATS.get(i, []))

    conn = db.get_conn()
    rows = [dict(r) for r in conn.execute(
        f"SELECT * FROM ({_PLACES_UNION}) WHERE kind IN ('mosque','attraction','food','fruit')")]
    conn.close()

    edible = {"food", "fruit"}

    def score(p):
        s = profile["w"].get(p["category"], 1.0)
        if p["category"] in boost:
            s *= 1.8
        if p["thumb"]:
            s *= 1.15                                    # prefer entries we can illustrate
        if p["kind"] not in edible and _km(p["distance"]) > profile["max_km"]:
            s *= 0.15
        return s

    food = sorted([p for p in rows if p["kind"] in edible], key=score, reverse=True)
    sights = sorted([p for p in rows if p["kind"] not in edible], key=score, reverse=True)

    by_state = {}
    for p in sights:
        by_state.setdefault(p["state"] or "Kuala Lumpur", []).append(p)

    slim = lambda p: {"kind": p["kind"], "id": p["id"], "name": p["name"],
                      "category": p["category"], "state": p["state"], "distance": p["distance"]}

    out, used, day_no, fi = [], set(), 0, 0
    for leg_name, leg_days in _allocate_legs(days_total):
        pool = [p for st in _REGIONS[leg_name] for p in by_state.get(st, [])]
        pool.sort(key=score, reverse=True)
        for _ in range(leg_days):
            day_no += 1
            picks, mosque_due = [], (day_no % 2 == 1)
            for p in pool:
                if len(picks) >= profile["per_day"]:
                    break
                key = f"{p['kind']}{p['id']}"
                if key in used:
                    continue
                is_mosque = p["category"] == "Mosques & Islamic Sites"
                if is_mosque and not mosque_due and any(
                        x["category"] == "Mosques & Islamic Sites" for x in picks):
                    continue
                picks.append(p); used.add(key)
                if is_mosque:
                    mosque_due = False
            if not picks:
                continue
            dish = food[fi % len(food)] if food else None
            fi += 1
            cats = [p["category"] for p in picks]
            theme = max(set(cats), key=cats.count)
            out.append({"day": day_no, "region": leg_name, "theme": theme,
                        "places": [slim(p) for p in picks],
                        "food": slim(dish) if dish else None})

    notes = list(profile["tips"])
    if req.pax >= 5:
        notes.append(f"For {req.pax} people, a 6-seater Grab or a small van hire is usually "
                     "cheaper than several separate cars.")
    if days_total >= 14:
        notes.append("Domestic flights (AirAsia, Batik, Firefly) make the long legs painless — "
                     "book them a couple of weeks ahead.")
    notes.append("Prayer times shift through the year; check the Prayer & Qibla page for your dates.")

    return {"duration": req.duration, "days": days_total, "party": profile["label"],
            "pax": req.pax, "itinerary": out, "notes": notes}


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
    out = {t: n(t) for t in ["mosques", "attractions", "food", "fruits", "medical", "accommodation",
                             "saved_itineraries", "enquiries", "reviews"]}
    conn.close()
    return out


# ---------- static frontend ----------
@app.get("/")
def index():
    return FileResponse(os.path.join(BASE, "templates", "index.html"))


app.mount("/static", StaticFiles(directory=os.path.join(BASE, "static")), name="static")
