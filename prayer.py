"""
Astronomical prayer-time & Qibla calculation engine (pure stdlib).
JAKIM (Malaysia) convention: Fajr 20deg, Isha 18deg, Shafi'i Asr. TZ +8.
"""
import math
import datetime

def _sin(d): return math.sin(math.radians(d))
def _cos(d): return math.cos(math.radians(d))
def _tan(d): return math.tan(math.radians(d))
def _asin(x): return math.degrees(math.asin(x))
def _acos(x): return math.degrees(math.acos(x))
def _atan2(y, x): return math.degrees(math.atan2(y, x))
def _acot(x): return math.degrees(math.atan2(1, x))
def _fix(a, b):
    a = a - b * math.floor(a / b)
    return a + b if a < 0 else a
def _fixhour(a): return _fix(a, 24.0)
def _fixangle(a): return _fix(a, 360.0)


def julian(year, month, day):
    if month <= 2:
        year -= 1
        month += 12
    A = math.floor(year / 100)
    B = 2 - A + math.floor(A / 4)
    return (math.floor(365.25 * (year + 4716)) +
            math.floor(30.6001 * (month + 1)) + day + B - 1524.5)


def sun_position(jd):
    D = jd - 2451545.0
    g = _fixangle(357.529 + 0.98560028 * D)
    q = _fixangle(280.459 + 0.98564736 * D)
    L = _fixangle(q + 1.915 * _sin(g) + 0.020 * _sin(2 * g))
    e = 23.439 - 0.00000036 * D
    RA = _fixhour(_atan2(_cos(e) * _sin(L), _cos(L)) / 15.0)
    decl = _asin(_sin(e) * _sin(L))
    eqt = q / 15.0 - RA
    return decl, eqt


def _time_diff(angle, decl, lat):
    x = (-_sin(angle) - _sin(lat) * _sin(decl)) / (_cos(lat) * _cos(decl))
    x = max(-1.0, min(1.0, x))
    return _acos(x) / 15.0


def _asr_diff(factor, decl, lat):
    angle = -_acot(factor + _tan(abs(lat - decl)))
    x = (-_sin(angle) - _sin(lat) * _sin(decl)) / (_cos(lat) * _cos(decl))
    x = max(-1.0, min(1.0, x))
    return _acos(x) / 15.0


def _hm(hours):
    hours = _fixhour(hours)
    h = int(hours)
    m = int(round((hours - h) * 60))
    if m == 60:
        h += 1
        m = 0
    return f"{h:02d}:{m:02d}"


def prayer_times(lat, lng, date=None, tz=8, fajr_angle=20.0, isha_angle=18.0, asr_factor=1.0):
    if date is None:
        date = datetime.date.today()
    jd = julian(date.year, date.month, date.day) - lng / (15.0 * 24.0)
    decl, eqt = sun_position(jd)
    dhuhr = 12.0 + tz - lng / 15.0 - eqt
    return {
        "Fajr": _hm(dhuhr - _time_diff(fajr_angle, decl, lat)),
        "Syuruk": _hm(dhuhr - _time_diff(0.833, decl, lat)),
        "Dhuhr": _hm(dhuhr),
        "Asr": _hm(dhuhr + _asr_diff(asr_factor, decl, lat)),
        "Maghrib": _hm(dhuhr + _time_diff(0.833, decl, lat)),
        "Isha": _hm(dhuhr + _time_diff(isha_angle, decl, lat)),
    }


KAABA = (21.4225, 39.8262)

def qibla_bearing(lat, lng):
    klat, klng = KAABA
    dlng = klng - lng
    y = _sin(dlng) * _cos(klat)
    x = _cos(lat) * _sin(klat) - _sin(lat) * _cos(klat) * _cos(dlng)
    return _fixangle(_atan2(y, x))


if __name__ == "__main__":
    d = datetime.date(2026, 8, 8)
    print("KL", prayer_times(3.1390, 101.6869, d))
    print("Qibla KL:", round(qibla_bearing(3.139, 101.6869), 1))
