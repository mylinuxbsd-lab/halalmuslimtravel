"""Seed dataset for the Malaysia Muslim-Friendly Tourism Portal.
Coordinates approximate; distances computed from KLCC at runtime."""

KLCC = {"lat": 3.1578, "lng": 101.7117}

MOSQUES = [
    ("Masjid Putra", "Putrajaya", 2.9354, 101.6910, "Iconic rose-tinted granite mosque beside Putrajaya Lake.", "9:00-18:00 (closed during prayers)", "Robes provided for visitors"),
    ("Masjid Sultan Salahuddin Abdul Aziz", "Shah Alam", 3.0793, 101.5207, "The 'Blue Mosque' - one of the largest in Southeast Asia.", "10:00-13:00, 14:00-16:00, 17:30-18:30", "Robes & scarves provided"),
    ("Masjid Wilayah Persekutuan", "Kuala Lumpur", 3.1725, 101.6710, "Ottoman-inspired federal territory mosque with 22 domes.", "10:00-12:30, 14:30-16:00, 17:30-18:30", "Robes provided"),
    ("Masjid Tuanku Mizan Zainal Abidin", "Putrajaya", 2.9187, 101.6790, "The 'Iron Mosque' with architectural steel lattice walls.", "9:00-18:00 (closed during prayers)", "Modest dress required"),
    ("Masjid Kristal", "Kuala Terengganu", 5.3020, 103.1780, "The Crystal Mosque built of steel, glass and crystal.", "8:30-22:00", "Robes provided"),
    ("Masjid Jamek", "Kuala Lumpur", 3.1490, 101.6958, "One of KL's oldest mosques at the river confluence.", "8:30-12:30, 14:30-16:00", "Robes provided"),
    ("Masjid Ubudiah", "Kuala Kangsar", 4.7649, 100.9340, "Golden-domed royal mosque of Perak.", "9:00-17:00 (closed during prayers)", "Modest dress required"),
    ("Masjid Sendayan", "Negeri Sembilan", 2.7480, 101.8600, "Modern architectural mosque in Bandar Sri Sendayan.", "Open daily (closed during prayers)", "Modest dress required"),
    ("Islamic Arts Museum Malaysia", "Kuala Lumpur", 3.1416, 101.6869, "Largest museum of Islamic arts in Southeast Asia.", "9:30-18:00", "Smart casual, modest"),
    ("Masjid Bandaraya", "Kota Kinabalu", 5.9880, 116.0760, "The 'Floating Mosque' on a man-made lagoon.", "8:00-17:00 (closed during prayers)", "Robes provided"),
    ("Masjid Habib", "Penang", 5.4141, 100.3288, "Historic mosque in the heart of George Town.", "9:00-17:00", "Modest dress required"),
    ("Masjid Zabedah (ISTAC)", "Kuala Lumpur", 3.1720, 101.6360, "Andalusian-style mosque at the ISTAC campus.", "By visiting hours", "Modest dress required"),
]

FOOD = [
    ("Nasi Lemak", "National Dish", "Coconut rice with sambal, anchovies, peanuts & egg.", "Best eaten fresh in the morning."),
    ("Roti Canai", "Breakfast", "Flaky flatbread served with dhal or curry.", "Pair with teh tarik (pulled tea)."),
    ("Rendang", "Main", "Slow-cooked spiced beef in coconut milk.", "Popular during festive seasons."),
    ("Satay", "Grill", "Skewered grilled meat with peanut sauce.", "Kajang is the satay capital."),
    ("Laksa", "Noodle", "Spicy/tangy noodle soup, many regional styles.", "Try Penang Asam Laksa & Curry Laksa."),
]

VENUES = [
    ("Night Market", "Jalan Alor Night Food Street", 3.1462, 101.7089),
    ("Night Market", "Taman Connaught Night Market", 3.0790, 101.7360),
    ("Night Market", "SS2 Night Market", 3.1170, 101.6220),
    ("Night Market", "Setia Alam Night Market", 3.1060, 101.4500),
    ("Seasonal", "Bazaar Ramadan", 3.1400, 101.7000),
    ("Fine Dining", "Atmosphere 360", 3.1528, 101.7038),
    ("View Dining", "SkyBar (non-alcoholic options)", 3.1478, 101.7115),
    ("Fine Dining", "Marini's on 57", 3.1580, 101.7120),
]

ATTRACTIONS = [
    ("City & Nature", "Urban Landmark", "Petronas Twin Towers", 3.1578, 101.7117),
    ("City & Nature", "Urban Landmark", "KL Tower", 3.1528, 101.7038),
    ("City & Nature", "Urban Landmark", "Merdeka Square", 3.1478, 101.6935),
    ("City & Nature", "Heritage", "Central Market", 3.1457, 101.6957),
    ("City & Nature", "Heritage", "Kuala Lumpur Railway Station", 3.1390, 101.6930),
    ("City & Nature", "Nature", "KL Forest Eco Park", 3.1533, 101.7057),
    ("City & Nature", "Nature", "Perdana Botanical Garden", 3.1430, 101.6860),
    ("Theme Parks", "Pahang", "Genting Highlands Theme Park", 3.4237, 101.7930),
    ("Theme Parks", "Petaling Jaya", "Sunway Lagoon", 3.0700, 101.6070),
    ("Theme Parks", "Ipoh", "Lost World of Tambun", 4.6480, 101.1470),
    ("Theme Parks", "Johor Bahru", "Legoland Malaysia", 1.4270, 103.6320),
    ("Theme Parks", "Johor", "Desaru Coast Adventure Waterpark", 1.5540, 104.2620),
    ("Theme Parks", "Penang", "Escape Adventureplay", 5.3600, 100.2000),
    ("Family & Kids", "Science centre at KLCC", "Petrosains Discovery Centre", 3.1580, 101.7120),
    ("Family & Kids", "Oceanarium walk-through tunnel", "Aquaria KLCC", 3.1540, 101.7130),
    ("Family & Kids", "Role-play edutainment city", "KidZania", 3.1180, 101.6440),
    ("Family & Kids", "Zoo Negara - 5,000+ animals", "National Zoo & Aquarium", 3.2100, 101.7580),
    ("Family & Kids", "Petting farm & conservation park", "Farm in the City", 2.9990, 101.7250),
    ("Family & Kids", "Indoor adventure park (IOI City Mall)", "District 21", 2.9720, 101.7130),
]

MEDICAL = [
    ("Subang Jaya Medical Centre (SJMC)", "Multi-specialty | JCI", 3.0840, 101.5860, "Surau on-site"),
    ("Gleneagles Kuala Lumpur", "Cardiology | Oncology | JCI", 3.1620, 101.7360, "Prayer room available"),
    ("Prince Court Medical Centre", "Multi-specialty | JCI", 3.1560, 101.7250, "Prayer facilities on-site"),
]

HOTELS = [
    ("Muslim-Friendly City Hotel (KLCC)", "Halal breakfast|Qibla marker|Prayer mat on request|No minibar alcohol", 3.1560, 101.7130),
    ("Family Suites Bukit Bintang", "Halal kitchen|Near mosque|Prayer mat on request", 3.1460, 101.7110),
    ("Putrajaya Lakeside Resort", "Halal dining|Qibla marker|Steps from Masjid Putra", 2.9360, 101.6900),
]

TRANSPORT = [
    ("LRT / MRT / Monorail", "Extensive urban rail across the Klang Valley."),
    ("ERL (KLIA Transit/Ekspres)", "Fast airport rail link to KL Sentral."),
    ("Ride-hailing (Grab)", "Primary app-based taxi service nationwide."),
    ("Intercity Buses", "Affordable coaches from TBS terminal."),
    ("Domestic Flights", "AirAsia, Batik Air, Firefly connect all states."),
]

APPS = [
    ("Grab", "Transport & Navigation"), ("AirAsia MOVE", "Transport & Navigation"),
    ("Waze", "Transport & Navigation"), ("Google Maps", "Transport & Navigation"),
    ("Touch 'n Go eWallet", "Payments"), ("ShopeePay", "Payments"),
    ("Foodpanda", "Food Delivery & Retail"), ("Shopee", "Food Delivery & Retail"),
]

PRACTICAL = [
    ("Entry Requirements & Visas", "Many nationalities enjoy visa-free entry for up to 90 days. Use the Malaysia Digital Arrival Card (MDAC) before travel. Check customs limits for currency and goods."),
    ("Currency & Banking", "Currency is the Malaysian Ringgit (MYR). ATMs are widely available; cards and e-wallets (Touch 'n Go) are broadly accepted. Carry small cash for night markets."),
    ("Climate & Weather", "Hot and humid year-round (26-33C). East coast monsoon runs Nov-Mar. Pack light, breathable modest clothing, an umbrella, and plan indoor malls for rainy afternoons."),
    ("Emergency Contacts", "Police/Ambulance/Fire: 999 (or 112 from mobile). Tourist Police hotline: 03-2149 6590. Save your embassy contact and hotel address."),
]

ITINERARIES = {
    "3": [
        (1, "Spiritual & City Icons", ["Masjid Wilayah Persekutuan", "Islamic Arts Museum", "Petronas Twin Towers", "Jalan Alor (dinner)"]),
        (2, "Family Day", ["Aquaria KLCC", "Petrosains", "KL Tower", "SkyBar (mocktails)"]),
        (3, "Putrajaya Day Trip", ["Masjid Putra", "Masjid Tuanku Mizan", "Putrajaya Lake Cruise"]),
    ],
    "5": [
        (1, "Arrival & KL Icons", ["Merdeka Square", "Central Market", "Masjid Jamek"]),
        (2, "Spiritual Trail", ["Masjid Wilayah", "Islamic Arts Museum", "Blue Mosque (Shah Alam)"]),
        (3, "Theme Park", ["Genting Highlands Theme Park"]),
        (4, "Family & Nature", ["National Zoo", "KL Forest Eco Park", "Perdana Botanical Garden"]),
        (5, "Putrajaya & Shopping", ["Masjid Putra", "Masjid Tuanku Mizan", "IOI City Mall / District 21"]),
    ],
    "7": [
        (1, "Arrival & KL Icons", ["Petronas Twin Towers", "KL Tower", "Jalan Alor"]),
        (2, "Heritage KL", ["Merdeka Square", "Central Market", "Masjid Jamek"]),
        (3, "Spiritual Trail", ["Masjid Wilayah", "Blue Mosque", "Islamic Arts Museum"]),
        (4, "Genting Day Trip", ["Genting Highlands Theme Park"]),
        (5, "Family Fun", ["Aquaria KLCC", "Petrosains", "KidZania"]),
        (6, "Putrajaya", ["Masjid Putra", "Masjid Tuanku Mizan", "Lake Cruise"]),
        (7, "Melaka Day Trip", ["Melaka Historic City", "A Famosa", "Jonker Street"]),
    ],
}
