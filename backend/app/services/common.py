"""Utility kecil yang dipakai banyak service."""

from datetime import date, datetime, timezone


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def today_str() -> str:
    return date.today().strftime("%Y-%m-%d")
