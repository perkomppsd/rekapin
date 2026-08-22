"""Operasi dasar dokumen kandidat (dipakai endpoint create/bulk/upload)."""

import uuid
from typing import List, Optional, Tuple

from ..db import db
from ..models import CandidateCreate
from ..schema import FIELD_BY_KEY
from . import nik as nik_service
from .common import now_iso
from .rules import apply_auto_rules


def prepare_new(data: dict, user: dict, when: Optional[str] = None) -> dict:
    """Lengkapi dict kandidat baru: auto rules + metadata sistem."""
    doc = apply_auto_rules({}, dict(data))
    stamp = when or now_iso()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = stamp
    doc["updated_at"] = stamp
    doc["created_by"] = user["id"]
    doc["created_by_email"] = user["email"]
    return doc


def coerce_value(key: str, raw) -> Optional[object]:
    """Ubah nilai mentah dari Excel/paste sesuai tipe field di schema.py."""
    spec = FIELD_BY_KEY.get(key)
    if raw is None:
        return None
    if spec is not None and spec.py_type is int:
        try:
            return int(float(str(raw).strip()))
        except (TypeError, ValueError):
            return None
    return str(raw).strip()


def from_import_row(values: dict) -> Optional[dict]:
    """Validasi satu baris import. Return dict siap simpan, atau None kalau invalid."""
    if not values.get("nama"):
        return None
    try:
        return CandidateCreate(**values).model_dump()
    except Exception:
        return None


async def split_by_nik(rows: List[dict]) -> Tuple[List[dict], List[dict]]:
    """Pisahkan baris import yang layak simpan dari yang harus dilewati.

    Yang dilewati: NIK formatnya salah, NIK dobel di dalam file yang sama, atau
    NIK sudah ada di database. Satu baris bermasalah TIDAK membatalkan import
    seluruh file — barisnya dilaporkan balik ke user.

    Return (rows_ok, skipped) dengan skipped berisi {nama, nik, alasan}.
    """
    ok: List[dict] = []
    skipped: List[dict] = []

    # Ambil semua pemilik NIK yang sudah ada dalam satu query.
    wanted = {nik_service.normalize(r.get("nik")) for r in rows}
    wanted.discard("")
    existing = {}
    if wanted:
        cursor = db.candidates.find({"nik": {"$in": sorted(wanted)}}, {"_id": 0})
        async for doc in cursor:
            existing[doc.get("nik")] = doc

    seen_in_file = {}
    for row in rows:
        row_nik_raw = row.get("nik")
        nik = nik_service.normalize(row_nik_raw)
        row["nik"] = nik  # simpan versi ternormalisasi (tanpa spasi/titik)
        nama = row.get("nama", "")

        reason = nik_service.reject_reason(row_nik_raw)
        if reason:
            skipped.append({"nama": nama, "nik": nik, "alasan": reason})
            continue
        if nik and nik in seen_in_file:
            skipped.append({"nama": nama, "nik": nik,
                            "alasan": f"NIK dobel di dalam file (sama dengan {seen_in_file[nik]})"})
            continue
        if nik and nik in existing:
            skipped.append({"nama": nama, "nik": nik,
                            "alasan": nik_service.duplicate_message(existing[nik])})
            continue

        if nik:
            seen_in_file[nik] = nama or nik
        ok.append(row)

    return ok, skipped
