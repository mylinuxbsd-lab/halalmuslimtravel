#!/usr/bin/env python3
"""One-off: resolve a list of (name, location hint, state) into verified real
places via the Google Places API (New) -- coordinates, formatted address,
and a photo, all from a single Text Search call per mosque.

Used to backfill new mosque rows from a curated name list where none of the
usual seed data (coordinates, photo) exists yet. A candidate is accepted
only if BOTH:
  - the returned formatted address mentions the expected state (catches a
    same-named mosque resolving to the wrong state entirely)
  - the mosque's own name and the returned displayName share a distinctive
    word (generic words like "mosque"/"state"/"jamek" excluded)
Anything failing either check is left for manual research, not guessed.

Usage: GOOGLE_MAPS_KEY=... python3 tools/discover_mosques.py [--dry-run]
Reads tools/mosques_to_add.py for the input list (name, location, state).
Writes results to /tmp/mosque_discovery.json.
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
API_KEY = os.environ.get("GOOGLE_MAPS_KEY", "").strip()
FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.photos,places.location"

_STOP = {"the", "a", "an", "of", "in", "at", "and", "malaysia", "malaysian"}
_GENERIC_WORD = {
    "mosque", "masjid", "state", "district", "town", "city", "national", "royal",
    "jamek", "bandar", "raya", "old", "new", "foundation", "mosque",
}


def sig_words(s):
    return {w for w in re.findall(r"[a-z0-9]+", s.lower()) if w not in _STOP and len(w) > 2}


def shared_distinctive_word(a, b):
    shared = (sig_words(a) - _GENERIC_WORD) & (sig_words(b) - _GENERIC_WORD)
    return next(iter(shared), None)


def search_place(name, location, state):
    query = f"{name}, {location}, {state}, Malaysia"
    body = {"textQuery": query, "maxResultCount": 1, "languageCode": "en"}
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
        return None, f"HTTP {e.code}: {e.read().decode('utf-8', 'ignore')[:200]}"
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
    if not API_KEY:
        sys.exit("GOOGLE_MAPS_KEY is not set.")
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from mosques_to_add import MOSQUES_TO_ADD

    results = {}
    for i, (name, location, state) in enumerate(MOSQUES_TO_ADD, 1):
        place, status = search_place(name, location, state)
        if not place:
            print(f"[{i}/{len(MOSQUES_TO_ADD)}] {name[:42]:44s} -> {status}")
            results[name] = {"accept": False, "reason": status}
            time.sleep(0.3)
            continue

        matched_name = (place.get("displayName") or {}).get("text", "?")
        addr = place.get("formattedAddress", "")
        loc = place.get("location") or {}
        state_ok = state.lower() in addr.lower()
        word = shared_distinctive_word(name, matched_name)

        if state_ok and word:
            ref, attrib = pick_photo(place)
            results[name] = {
                "accept": True, "matched_name": matched_name, "address": addr,
                "lat": loc.get("latitude"), "lng": loc.get("longitude"),
                "photo_ref": ref, "photo_attrib": attrib, "shared_word": word,
            }
            print(f"[{i}/{len(MOSQUES_TO_ADD)}] {name[:42]:44s} -> OK  ({matched_name}) [{word}]"
                  + ("" if ref else "  (no photo)"))
        else:
            reason = []
            if not state_ok: reason.append(f"address doesn't mention {state}")
            if not word: reason.append("no shared distinctive word")
            results[name] = {"accept": False, "reason": "; ".join(reason),
                              "matched_name": matched_name, "address": addr}
            print(f"[{i}/{len(MOSQUES_TO_ADD)}] {name[:42]:44s} -> REVIEW  matched '{matched_name}' but {'; '.join(reason)}")
        time.sleep(0.3)

    json.dump(results, open("/tmp/mosque_discovery.json", "w"), indent=2)
    accepted = sum(1 for r in results.values() if r["accept"])
    print(f"\naccepted={accepted} needs_review={len(results) - accepted}")


if __name__ == "__main__":
    main()
