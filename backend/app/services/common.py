"""Utility kecil yang dipakai banyak service."""

from datetime import date, datetime, timedelta, timezone
from typing import Optional


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def today_str() -> str:
    return date.today().strftime("%Y-%m-%d")


DATE_FMT = "%Y-%m-%d"


def parse_date(value: str):
    """'2026-08-22' -> date, atau None kalau formatnya bukan tanggal."""
    try:
        return datetime.strptime(str(value).strip(), DATE_FMT).date()
    except (TypeError, ValueError):
        return None


def age_from(birthdate: str, today=None) -> Optional[int]:
    """Umur (tahun penuh) dari tanggal lahir. None kalau tanggalnya tidak valid."""
    born = parse_date(birthdate)
    if born is None:
        return None
    ref = today or date.today()
    umur = ref.year - born.year - ((ref.month, ref.day) < (born.month, born.day))
    return umur if 0 <= umur <= 120 else None


def birthdate_from_nik(nik: str, today=None) -> str:
    """Ambil tanggal lahir dari NIK: digit 7-12 = DDMMYY.

    Untuk perempuan, DD ditambah 40 (aturan Dukcapil) — di sini dikembalikan
    ke tanggal aslinya. Abad ditebak dari tahun sekarang: YY yang lebih besar
    dari 2 digit tahun berjalan dianggap 19YY, sisanya 20YY.
    Return "" kalau NIK tidak berformat wajar atau tanggalnya tidak masuk akal.
    """
    nik = str(nik or "")
    if len(nik) != 16 or not nik.isdigit():
        return ""
    dd, mm, yy = int(nik[6:8]), int(nik[8:10]), int(nik[10:12])
    if dd > 40:
        dd -= 40                       # penanda perempuan
    if not (1 <= dd <= 31 and 1 <= mm <= 12):
        return ""
    ref = today or date.today()
    century = 1900 if yy > ref.year % 100 else 2000
    try:
        born = date(century + yy, mm, dd)
    except ValueError:
        return ""
    umur = ref.year - born.year - ((ref.month, ref.day) < (born.month, born.day))
    # Batas kewajaran pelamar kerja — mencegah NIK sementara/asal jadi tanggal.
    if not (15 <= umur <= 70):
        return ""
    return born.strftime(DATE_FMT)


def add_days(value: str, days: int) -> str:
    """Tambah hari ke tanggal berformat YYYY-MM-DD. Input invalid -> "" ."""
    d = parse_date(value)
    return (d + timedelta(days=days)).strftime(DATE_FMT) if d else ""
