#!/usr/bin/env python3
"""Backfill attraction photos from the Google Places API (New).

Only fills rows that have no photo yet -- it never overwrites a verified
Wikimedia image. Stores the photo *resource name* plus Google's required
attribution; the image itself is streamed by /api/place-photo/<id> so the
API key stays server-side and never reaches the browser.

Usage:
    GOOGLE_MAPS_KEY=... python3 tools/fetch_place_photos.py [--limit N] [--dry-run]

The key needs the "Places API (New)" enabled, and must NOT be restricted to
an HTTP referrer (this runs server-side -- use an IP restriction instead).
"""
import argparse
import json
import os
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
FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.photos"


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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="stop after N lookups")
    ap.add_argument("--dry-run", action="store_true", help="don't write to the DB")
    args = ap.parse_args()

    if not API_KEY:
        sys.exit("GOOGLE_MAPS_KEY is not set. Export it and re-run.")

    conn = db.get_conn()
    rows = conn.execute(
        "SELECT id, name, lat, lng FROM attractions "
        "WHERE (photo_thumb IS NULL OR photo_thumb = '') "
        "  AND (photo_ref IS NULL OR photo_ref = '') "
        "ORDER BY id"
    ).fetchall()

    todo = rows[: args.limit] if args.limit else rows
    print(f"{len(rows)} attractions without a photo; processing {len(todo)}\n")

    filled = skipped = failed = 0
    for i, r in enumerate(todo, 1):
        place, status = search_place(r["name"], r["lat"], r["lng"])
        if not place:
            print(f"[{i}/{len(todo)}] {r['name'][:44]:46s} -> {status}")
            failed += 1
            time.sleep(0.3)
            continue

        ref, attrib = pick_photo(place)
        matched = (place.get("displayName") or {}).get("text", "?")
        if not ref:
            print(f"[{i}/{len(todo)}] {r['name'][:44]:46s} -> matched '{matched}' but no photo")
            skipped += 1
            time.sleep(0.3)
            continue

        if not args.dry_run:
            conn.execute(
                "UPDATE attractions SET photo_ref = ?, photo_attrib = ? WHERE id = ?",
                (ref, attrib or "", r["id"]),
            )
            conn.commit()
        print(f"[{i}/{len(todo)}] {r['name'][:44]:46s} -> OK  ({matched}) [{attrib or 'no attribution'}]")
        filled += 1
        time.sleep(0.3)

    conn.close()
    print(f"\nfilled={filled} no_photo={skipped} failed={failed}"
          + ("   (dry run -- nothing written)" if args.dry_run else ""))


if __name__ == "__main__":
    main()
