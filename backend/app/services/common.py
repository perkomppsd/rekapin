"""Utility kecil yang dipakai banyak service."""

from datetime import date, datetime, timedelta, timezone


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


def add_days(value: str, days: int) -> str:
    """Tambah hari ke tanggal berformat YYYY-MM-DD. Input invalid -> "" ."""
    d = parse_date(value)
    return (d + timedelta(days=days)).strftime(DATE_FMT) if d else ""
