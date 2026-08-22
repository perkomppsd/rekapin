"""Bangun query MongoDB untuk listing kandidat (filter + pencarian + paginasi).

Semua penyaringan dikerjakan database, bukan browser. Jadi jumlah kandidat
tidak lagi dibatasi 5.000 dan dashboard tidak perlu menarik seluruh koleksi.
"""

import re
from typing import Any, Dict, List, Optional, Tuple

from .. import config
from ..schema import SEARCHABLE_FIELDS, stage_query
from . import scope as tenancy


def _and(clauses: List[dict]) -> dict:
    """Gabung beberapa klausa jadi satu query, tanpa $and kalau tidak perlu."""
    clauses = [c for c in clauses if c]
    if not clauses:
        return {}
    if len(clauses) == 1:
        return dict(clauses[0])
    return {"$and": clauses}


def _search_clause(q: str) -> dict:
    """Cari di semua field ber-`searchable=True`. Angka dicocokkan juga tanpa
    pemisah, supaya '3201 0112' tetap menemukan NIK '32010112...'."""
    q = (q or "").strip()
    if not q:
        return {}
    needles = {q}
    digits = re.sub(r"\D", "", q)
    if len(digits) >= 3:
        needles.add(digits)
    return {"$or": [
        {field: {"$regex": re.escape(n), "$options": "i"}}
        for n in needles
        for field in SEARCHABLE_FIELDS
    ]}


def _date_clause(date_from: Optional[str], date_to: Optional[str]) -> dict:
    """Filter tanggal input. Batas dihitung pada zona waktu lokal (lihat
    config.LOCAL_UTC_OFFSET_HOURS) supaya 'tanggal input' sesuai jam kantor."""
    if not date_from and not date_to:
        return {}
    off = config.LOCAL_UTC_OFFSET_HOURS
    sign = "+" if off >= 0 else "-"
    tz = f"{sign}{abs(off):02d}:00"
    window: Dict[str, str] = {}
    if date_from:
        window["$gte"] = f"{date_from}T00:00:00{tz}"
    if date_to:
        window["$lte"] = f"{date_to}T23:59:59{tz}"
    return {"created_at": window}


def build_query(user: dict, *, scope: str = "all", q: str = "",
                position: str = "", date_from: Optional[str] = None,
                date_to: Optional[str] = None) -> dict:
    """Query final: hak akses + tab + pencarian + posisi + rentang tanggal."""
    position_clause = {}
    if position and position != "all":
        position_clause = {"apply": position}
    return _and([
        tenancy.query_filter(user),
        stage_query(scope),
        _search_clause(q),
        position_clause,
        _date_clause(date_from, date_to),
    ])


def paginate(page: int, per_page: int) -> Tuple[int, int, int]:
    """Bersihkan input paginasi -> (page, per_page, skip)."""
    page = max(1, int(page or 1))
    per_page = min(max(1, int(per_page or config.DEFAULT_PAGE_SIZE)), config.MAX_PAGE_SIZE)
    return page, per_page, (page - 1) * per_page


def page_meta(total: int, page: int, per_page: int) -> Dict[str, Any]:
    pages = max(1, -(-total // per_page))  # pembagian dibulatkan ke atas
    return {"total": total, "page": page, "per_page": per_page, "pages": pages}
