"""Validasi & pengecekan NIK (Nomor Induk Kependudukan / no. KTP).

NIK dipakai sebagai kunci identitas kandidat:
  * satu NIK = satu kandidat (tidak bisa dobel),
  * kalau orang yang sama melamar lagi, riwayat & status blacklist-nya langsung
    ketahuan karena NIK-nya sudah ada di database.

NIK tetap OPSIONAL — kandidat yang NIK-nya belum dikumpulkan tetap bisa disimpan.
Keunikan dijaga di dua lapis: pengecekan di sini (pesan error jelas) dan
partial unique index di MongoDB (jaring pengaman kalau ada dua request bersamaan).
"""

import re
from typing import Optional

from fastapi import HTTPException

from ..db import db
from ..schema import is_blacklisted

NIK_LENGTH = 16
_NON_DIGIT = re.compile(r"\D")
# Pemisah yang ditoleransi saat user mengetik: spasi, titik, strip.
_ILLEGAL_CHARS = re.compile(r"[^\d\s.\-]")


def normalize(value) -> str:
    """Buang spasi/titik/strip supaya '3201 0112.3456 7890' -> '3201011234567890'."""
    if value is None:
        return ""
    return _NON_DIGIT.sub("", str(value))


def is_valid(nik: str) -> bool:
    return len(nik) == NIK_LENGTH and nik.isdigit()


def reject_reason(value) -> Optional[str]:
    """Alasan NIK tidak bisa diterima, atau None kalau valid/kosong."""
    raw = "" if value is None else str(value).strip()
    nik = normalize(raw)
    if not nik:
        return None                                   # NIK opsional
    if _ILLEGAL_CHARS.search(raw):
        return f"NIK hanya boleh berisi angka ({NIK_LENGTH} digit)"
    if len(nik) != NIK_LENGTH:
        return f"NIK harus {NIK_LENGTH} digit angka (yang diisi: {len(nik)} digit)"
    return None


def validate(value) -> str:
    """Return NIK yang sudah dinormalisasi. Kosong = dilewati (NIK opsional)."""
    reason = reject_reason(value)
    if reason:
        raise HTTPException(status_code=400, detail=reason)
    return normalize(value)


async def find_owner(nik: str, exclude_id: Optional[str] = None) -> Optional[dict]:
    """Cari kandidat lain yang sudah memakai NIK ini."""
    if not nik:
        return None
    query = {"nik": nik}
    if exclude_id:
        query["id"] = {"$ne": exclude_id}
    return await db.candidates.find_one(query, {"_id": 0})


def duplicate_message(existing: dict) -> str:
    """Pesan error yang menyebut siapa pemilik NIK — plus peringatan blacklist."""
    nama = existing.get("nama") or "kandidat lain"
    if is_blacklisted(existing):
        alasan = (existing.get("alasan_blacklist") or "").strip()
        pesan = f"NIK ini terdaftar sebagai {nama} yang ada di BLACKLIST"
        status = existing.get("status_blacklist") or ""
        if status:
            pesan += f" ({status})"
        return f"{pesan}." + (f" Alasan: {alasan}" if alasan else "")
    return (f"NIK ini sudah dipakai kandidat {nama}. "
            f"Buka data yang sudah ada dan edit di sana, jangan buat baru.")


async def assert_available(value, exclude_id: Optional[str] = None) -> str:
    """Validasi format + pastikan NIK belum dipakai. Return NIK ternormalisasi."""
    nik = validate(value)
    existing = await find_owner(nik, exclude_id)
    if existing is not None:
        raise HTTPException(status_code=409, detail=duplicate_message(existing))
    return nik
