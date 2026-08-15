"""SQLite database layer: schema creation, seeding, and helpers."""
import sqlite3
import json
import os
import seed_data as S

DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "portal.db"))
os.makedirs(os.path.dirname(os.path.abspath(DB_PATH)), exist_ok=True)


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(force=False):
    if force and os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    conn = get_conn()
    c = conn.cursor()
    c.executescript("""
    CREATE TABLE IF NOT EXISTS mosques(id INTEGER PRIMARY KEY, name TEXT, description TEXT, photo_url TEXT, maps_url TEXT, state TEXT, distance TEXT, travel_time TEXT, lat REAL, lng REAL, photo_thumb TEXT);
    CREATE TABLE IF NOT EXISTS attractions(id INTEGER PRIMARY KEY, category TEXT, name TEXT, description TEXT, photo_url TEXT, maps_url TEXT, state TEXT, distance TEXT, travel_time TEXT, lat REAL, lng REAL, photo_thumb TEXT);
    CREATE TABLE IF NOT EXISTS food(id INTEGER PRIMARY KEY, name TEXT, description TEXT, photo_url TEXT, photo_thumb TEXT);
    CREATE TABLE IF NOT EXISTS fruits(id INTEGER PRIMARY KEY, name TEXT, description TEXT, photo_url TEXT, photo_thumb TEXT);
    CREATE TABLE IF NOT EXISTS cartoons(id INTEGER PRIMARY KEY, name TEXT, description TEXT, link TEXT);
    CREATE TABLE IF NOT EXISTS youtubers(id INTEGER PRIMARY KEY, name TEXT, description TEXT, link TEXT);
    CREATE TABLE IF NOT EXISTS medical(id INTEGER PRIMARY KEY, name TEXT, description TEXT, specialties TEXT, website TEXT, maps_url TEXT, state TEXT, distance TEXT, travel_time TEXT, lat REAL, lng REAL);
    CREATE TABLE IF NOT EXISTS accommodation(id INTEGER PRIMARY KEY, name TEXT, category TEXT, description TEXT, website TEXT, maps_url TEXT, state TEXT, distance TEXT, lat REAL, lng REAL);
    CREATE TABLE IF NOT EXISTS transport(id INTEGER PRIMARY KEY, mode TEXT, coverage TEXT, description TEXT, how_it_works TEXT, website TEXT);
    CREATE TABLE IF NOT EXISTS apps(id INTEGER PRIMARY KEY, name TEXT, category TEXT, description TEXT, download_link TEXT);
    CREATE TABLE IF NOT EXISTS practical(id INTEGER PRIMARY KEY, group_name TEXT, category TEXT, information TEXT, details TEXT, notes TEXT);
    CREATE TABLE IF NOT EXISTS itinerary_items(id INTEGER PRIMARY KEY, duration TEXT, day_no INTEGER, activity TEXT, location TEXT, type TEXT, why TEXT, tips TEXT);
    CREATE TABLE IF NOT EXISTS saved_itineraries(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, items TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS enquiries(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, subject TEXT, message TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY AUTOINCREMENT, place TEXT, author TEXT, rating INTEGER, comment TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    """)

    if c.execute("SELECT COUNT(*) FROM mosques").fetchone()[0] == 0:
        c.executemany("INSERT INTO mosques(name,description,photo_url,maps_url,state,distance,travel_time,lat,lng,photo_thumb) VALUES(?,?,?,?,?,?,?,?,?,?)", S.MOSQUES)
        c.executemany("INSERT INTO attractions(category,name,description,photo_url,maps_url,state,distance,travel_time,lat,lng,photo_thumb) VALUES(?,?,?,?,?,?,?,?,?,?,?)", S.ATTRACTIONS)
        c.executemany("INSERT INTO food(name,description,photo_url,photo_thumb) VALUES(?,?,?,?)", S.FOOD)
        c.executemany("INSERT INTO fruits(name,description,photo_url,photo_thumb) VALUES(?,?,?,?)", S.FRUITS)
        c.executemany("INSERT INTO cartoons(name,description,link) VALUES(?,?,?)", S.CARTOONS)
        c.executemany("INSERT INTO youtubers(name,description,link) VALUES(?,?,?)", S.MALAYSIA_YOUTUBERS)
        c.executemany("INSERT INTO medical(name,description,specialties,website,maps_url,state,distance,travel_time,lat,lng) VALUES(?,?,?,?,?,?,?,?,?,?)", S.MEDICAL)
        c.executemany("INSERT INTO accommodation(name,category,description,website,maps_url,state,distance,lat,lng) VALUES(?,?,?,?,?,?,?,?,?)", S.ACCOMMODATION)
        c.executemany("INSERT INTO transport(mode,coverage,description,how_it_works,website) VALUES(?,?,?,?,?)", S.TRANSPORT)
        c.executemany("INSERT INTO apps(name,category,description,download_link) VALUES(?,?,?,?)", S.APPS)
        c.executemany("INSERT INTO practical(group_name,category,information,details,notes) VALUES(?,?,?,?,?)", S.PRACTICAL)
        c.executemany("INSERT INTO itinerary_items(duration,day_no,activity,location,type,why,tips) VALUES(?,?,?,?,?,?,?)", S.ITINERARY_ITEMS)
        c.executemany("INSERT INTO reviews(place,author,rating,comment) VALUES(?,?,?,?)", [
            ("Masjid Putra, Putrajaya", "Aisha R.", 5, "Breathtaking at sunset. Robes provided, very welcoming."),
            ("Nasi Lemak", "Omar K.", 5, "Best breakfast in KL, sambal was perfect."),
            ("Genting Skyway", "Farah L.", 4, "Cool weather, great for kids. Bring a jacket!"),
        ])
        conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db(force=True)
    conn = get_conn()
    for t in ["mosques", "attractions", "food", "fruits", "cartoons", "youtubers", "medical", "accommodation",
              "transport", "apps", "practical", "itinerary_items", "reviews"]:
        print(f"{t:24s}: {conn.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0]}")
    conn.close()
