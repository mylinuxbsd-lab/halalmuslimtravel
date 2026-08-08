"""SQLite database layer: schema creation, seeding, and helpers."""
import sqlite3
import math
import json
import os
import seed_data as S

DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "portal.db"))
os.makedirs(os.path.dirname(os.path.abspath(DB_PATH)), exist_ok=True)


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def dist_km(lat, lng):
    R = 6371.0
    r = math.radians
    dlat = r(lat - S.KLCC["lat"])
    dlng = r(lng - S.KLCC["lng"])
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(r(S.KLCC["lat"])) * math.cos(r(lat)) * math.sin(dlng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def dist_label(lat, lng):
    km = dist_km(lat, lng)
    mins = round(km * 1.6 + 8)
    return f"{km:.1f} km \u00b7 ~{mins} min from KLCC"


def init_db(force=False):
    if force and os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    conn = get_conn()
    c = conn.cursor()
    c.executescript("""
    CREATE TABLE IF NOT EXISTS mosques(id INTEGER PRIMARY KEY, name TEXT, city TEXT, lat REAL, lng REAL, note TEXT, hours TEXT, dress TEXT);
    CREATE TABLE IF NOT EXISTS food(id INTEGER PRIMARY KEY, name TEXT, tag TEXT, note TEXT, tip TEXT);
    CREATE TABLE IF NOT EXISTS venues(id INTEGER PRIMARY KEY, type TEXT, name TEXT, lat REAL, lng REAL);
    CREATE TABLE IF NOT EXISTS attractions(id INTEGER PRIMARY KEY, grp TEXT, category TEXT, name TEXT, lat REAL, lng REAL);
    CREATE TABLE IF NOT EXISTS medical(id INTEGER PRIMARY KEY, name TEXT, specialty TEXT, lat REAL, lng REAL, prayer TEXT);
    CREATE TABLE IF NOT EXISTS hotels(id INTEGER PRIMARY KEY, name TEXT, perks TEXT, lat REAL, lng REAL);
    CREATE TABLE IF NOT EXISTS transport(id INTEGER PRIMARY KEY, mode TEXT, note TEXT);
    CREATE TABLE IF NOT EXISTS apps(id INTEGER PRIMARY KEY, name TEXT, category TEXT);
    CREATE TABLE IF NOT EXISTS practical(id INTEGER PRIMARY KEY, title TEXT, body TEXT);
    CREATE TABLE IF NOT EXISTS prebuilt_itineraries(id INTEGER PRIMARY KEY, days TEXT, day_no INTEGER, title TEXT, items TEXT);
    CREATE TABLE IF NOT EXISTS saved_itineraries(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, items TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS enquiries(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, subject TEXT, message TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY AUTOINCREMENT, place TEXT, author TEXT, rating INTEGER, comment TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    """)

    if c.execute("SELECT COUNT(*) FROM mosques").fetchone()[0] == 0:
        c.executemany("INSERT INTO mosques(name,city,lat,lng,note,hours,dress) VALUES(?,?,?,?,?,?,?)", S.MOSQUES)
        c.executemany("INSERT INTO food(name,tag,note,tip) VALUES(?,?,?,?)", S.FOOD)
        c.executemany("INSERT INTO venues(type,name,lat,lng) VALUES(?,?,?,?)", S.VENUES)
        c.executemany("INSERT INTO attractions(grp,category,name,lat,lng) VALUES(?,?,?,?,?)", S.ATTRACTIONS)
        c.executemany("INSERT INTO medical(name,specialty,lat,lng,prayer) VALUES(?,?,?,?,?)", S.MEDICAL)
        c.executemany("INSERT INTO hotels(name,perks,lat,lng) VALUES(?,?,?,?)", S.HOTELS)
        c.executemany("INSERT INTO transport(mode,note) VALUES(?,?)", S.TRANSPORT)
        c.executemany("INSERT INTO apps(name,category) VALUES(?,?)", S.APPS)
        c.executemany("INSERT INTO practical(title,body) VALUES(?,?)", S.PRACTICAL)
        rows = []
        for days, plan in S.ITINERARIES.items():
            for day_no, title, items in plan:
                rows.append((days, day_no, title, json.dumps(items)))
        c.executemany("INSERT INTO prebuilt_itineraries(days,day_no,title,items) VALUES(?,?,?,?)", rows)
        c.executemany("INSERT INTO reviews(place,author,rating,comment) VALUES(?,?,?,?)", [
            ("Masjid Putra", "Aisha R.", 5, "Breathtaking at sunset. Robes provided, very welcoming."),
            ("Nasi Lemak", "Omar K.", 5, "Best breakfast in KL, sambal was perfect."),
            ("Genting Highlands Theme Park", "Farah L.", 4, "Cool weather, great for kids. Bring a jacket!"),
        ])
        conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db(force=True)
    conn = get_conn()
    for t in ["mosques", "food", "venues", "attractions", "medical", "hotels",
              "transport", "apps", "practical", "prebuilt_itineraries", "reviews"]:
        print(f"{t:24s}: {conn.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0]}")
    conn.close()
