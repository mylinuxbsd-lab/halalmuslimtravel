#!/usr/bin/env python3
"""Backfill attraction photos from the Google Places API (New).

Only fills rows that have no photo yet -- it never overwrites a verified
Wikimedia image. Stores the photo *resource name* plus Google's required
attribution; the image itself is streamed by /api/place-photo/<id> so the
API key stays server-side and never reaches the browser.

A text-search match is not trusted on name alone -- name similarity missed
real errors before (e.g. "SkyTrex Adventure, Shah Alam" silently matching a
same-brand branch 35km away in Hulu Langat). Every candidate is checked
against BOTH signals:
  - distance from the attraction's own stored lat/lng (its most reliable
    fact, since photos/descriptions are what's actually been wrong)
  - shared distinctive words between the two names, generic words like
    "mall"/"park"/"resort" excluded so they can't produce a false match

A candidate passes if it's close (<=CLOSE_KM) regardless of naming, since
nearby + no reason to doubt it beats leaving a real venue with no photo; or
farther but with a genuine shared name-word (covers large-footprint places
like national parks, where the stored point can be far from the matched
landmark inside it). Anything else is left for a human -- printed with its
distance and reason rather than silently accepted or silently dropped.

Usage:
    GOOGLE_MAPS_KEY=... python3 tools/fetch_place_photos.py [--table attractions|mosques] [--limit N] [--dry-run]

The key needs the "Places API (New)" enabled, and must NOT be restricted to
an HTTP referrer (this runs server-side -- use an IP restriction instead).
"""
import argparse
import json
import math
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db

SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
API_KEY = os.environ.get("GOOGLE_MAPS_KEY", "").strip()

# Ask only for the fields we use -- Places bills per field mask.
FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.photos,places.location"

CLOSE_KM = 5.0     # this close, accept regardless of naming
FAR_KM = 30.0      # beyond this, no name overlap can save it

_STOP = {"the", "a", "an", "of", "in", "at", "and", "malaysia", "malaysian"}
_GENERIC_WORD = {
    "mall", "park", "resort", "hotel", "theme", "world", "centre", "center",
    "garden", "gardens", "island", "islands", "beach", "lake", "river",
    "mountain", "hill", "hills", "valley", "forest", "farm", "village",
    "city", "town", "state", "national", "adventure", "kids", "kid",
    "playground", "museum", "gallery", "market", "square", "walk", "trail",
}


def sig_words(s):
    return {w for w in re.findall(r"[a-z0-9]+", s.lower()) if w not in _STOP and len(w) > 2}


def shared_distinctive_word(a, b):
    shared = (sig_words(a) - _GENERIC_WORD) & (sig_words(b) - _GENERIC_WORD)
    return next(iter(shared), None)


def haversine_km(lat1, lng1, lat2, lng2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def search_place(name, lat, lng):
    """Find the place, biased to its known coordinates so we don't match a
    same-named venue in another country."""
    body = {"textQuery": f"{name}, Malaysia", "maxResultCount": 1, "languageCode": "en"}
    if lat and lng:
        body["locationBias"] = {
            "circle": {"center": {"latitude": lat, "longitude": lng}, "radius": 20000.0}
        }
    req = urllib.request.Request(
        SEARCH_URL,
        data=json.dumps(body).encode(),
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": API_KEY,
            "X-Goog-FieldMask": FIELD_MASK,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "ignore")[:200]
        return None, f"HTTP {e.code}: {detail}"
    except Exception as e:
        return None, f"error: {e}"

    places = data.get("places") or []
    if not places:
        return None, "no-match"
    return places[0], "ok"


def pick_photo(place):
    photos = place.get("photos") or []
    if not photos:
        return None, None
    p = photos[0]
    attribs = [a.get("displayName", "") for a in (p.get("authorAttributions") or [])]
    return p.get("name"), " / ".join(a for a in attribs if a)


def validate(our_name, our_lat, our_lng, place):
    """Returns (accept: bool, reason: str, distance_km: float|None)."""
    loc = place.get("location") or {}
    p_lat, p_lng = loc.get("latitude"), loc.get("longitude")
    matched_name = (place.get("displayName") or {}).get("text", "?")
    word = shared_distinctive_word(our_name, matched_name)

    if p_lat is None or our_lat is None:
        # No coordinates to check against -- fall back to name alone.
        return (bool(word), f"no coords, name-word={word}", None)

    dist = haversine_km(our_lat, our_lng, p_lat, p_lng)
    if dist <= CLOSE_KM:
        return (True, f"close ({dist:.1f}km)", dist)
    if dist <= FAR_KM and word:
        return (True, f"{dist:.1f}km but shares '{word}'", dist)
    if dist > FAR_KM:
        return (False, f"too far ({dist:.1f}km), likely wrong branch/location", dist)
    return (False, f"{dist:.1f}km with no shared name-word", dist)


TABLES = ("attractions", "mosques")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--table", choices=TABLES, default="attractions")
    ap.add_argument("--limit", type=int, default=0, help="stop after N lookups")
    ap.add_argument("--dry-run", action="store_true", help="don't write to the DB")
    args = ap.parse_args()
    table = args.table

    if not API_KEY:
        sys.exit("GOOGLE_MAPS_KEY is not set. Export it and re-run.")

    conn = db.get_conn()
    rows = conn.execute(
        f"SELECT id, name, lat, lng FROM {table} "
        "WHERE (photo_thumb IS NULL OR photo_thumb = '') "
        "  AND (photo_ref IS NULL OR photo_ref = '') "
        "ORDER BY id"
    ).fetchall()

    todo = rows[: args.limit] if args.limit else rows
    print(f"{len(rows)} {table} without a photo; processing {len(todo)}\n")

    filled = needs_review = no_photo = failed = 0
    for i, r in enumerate(todo, 1):
        place, status = search_place(r["name"], r["lat"], r["lng"])
        if not place:
            print(f"[{i}/{len(todo)}] {r['name'][:40]:42s} -> {status}")
            failed += 1
            time.sleep(0.3)
            continue

        matched_name = (place.get("displayName") or {}).get("text", "?")
        accept, reason, dist = validate(r["name"], r["lat"], r["lng"], place)

        if not accept:
            print(f"[{i}/{len(todo)}] {r['name'][:40]:42s} -> REVIEW  matched '{matched_name}' but {reason}")
            needs_review += 1
            time.sleep(0.3)
            continue

        ref, attrib = pick_photo(place)
        if not ref:
            print(f"[{i}/{len(todo)}] {r['name'][:40]:42s} -> matched '{matched_name}' ({reason}) but no photo")
            no_photo += 1
            time.sleep(0.3)
            continue

        if not args.dry_run:
            conn.execute(
                f"UPDATE {table} SET photo_ref = ?, photo_attrib = ? WHERE id = ?",
                (ref, attrib or "", r["id"]),
            )
            conn.commit()
        print(f"[{i}/{len(todo)}] {r['name'][:40]:42s} -> OK  ({matched_name}, {reason}) [{attrib or 'no attribution'}]")
        filled += 1
        time.sleep(0.3)

    conn.close()
    print(f"\nfilled={filled} needs_review={needs_review} no_photo={no_photo} failed={failed}"
          + ("   (dry run -- nothing written)" if args.dry_run else ""))


if __name__ == "__main__":
    main()
