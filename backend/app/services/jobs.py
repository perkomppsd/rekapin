"""Lowongan kerja (loker) yang dipasang admin & ditampilkan di portal publik."""

import re
import uuid
from typing import List, Optional

from fastapi import HTTPException

from ..db import db
from ..schema import STATUS_SETS
from .common import now_iso, today_str

COLLECTION = "job_postings"

DRAFT, AKTIF, TUTUP = "Draft", "Aktif", "Tutup"

# Field yang boleh dilihat publik — sengaja daftar putih, bukan daftar hitam,
# supaya field internal baru tidak ikut bocor tanpa sengaja.
PUBLIC_FIELDS = ("slug", "judul", "jobdesk", "unit_usaha", "tipe_kerja",
                 "deskripsi", "persyaratan", "kuota", "batas_lamaran", "created_at")


def _slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return s[:60] or "lowongan"


def publik(doc: dict) -> dict:
    return {k: doc.get(k) for k in PUBLIC_FIELDS}


def _validasi(payload: dict) -> None:
    if not (payload.get("judul") or "").strip():
        raise HTTPException(status_code=400, detail="Judul lowongan wajib diisi")
    for field, set_name in (("tipe_kerja", "tipe_kerja"), ("status", "status_lowongan")):
        nilai = payload.get(field)
        if nilai and nilai not in STATUS_SETS[set_name]:
            raise HTTPException(status_code=400, detail=f"{field} tidak valid: {nilai}")


async def _slug_unik(judul: str, exclude_id: Optional[str] = None) -> str:
    dasar = _slugify(judul)
    slug = dasar
    for i in range(2, 50):
        query = {"slug": slug}
        if exclude_id:
            query["id"] = {"$ne": exclude_id}
        if not await db[COLLECTION].find_one(query):
            return slug
        slug = f"{dasar}-{i}"
    return f"{dasar}-{uuid.uuid4().hex[:6]}"


async def buat(payload: dict, user: dict) -> dict:
    _validasi(payload)
    doc = dict(payload)
    doc["id"] = str(uuid.uuid4())
    doc["slug"] = await _slug_unik(payload["judul"])
    doc["status"] = payload.get("status") or DRAFT
    doc["created_at"] = doc["updated_at"] = now_iso()
    doc["created_by"] = user["id"]
    doc["created_by_nama"] = user.get("name", "")
    await db[COLLECTION].insert_one(doc)
    doc.pop("_id", None)
    return doc


async def ubah(job_id: str, payload: dict) -> dict:
    existing = await db[COLLECTION].find_one({"id": job_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Lowongan tidak ditemukan")
    updates = {k: v for k, v in payload.items() if v is not None}
    _validasi({**existing, **updates})
    if updates.get("judul") and updates["judul"] != existing["judul"]:
        updates["slug"] = await _slug_unik(updates["judul"], exclude_id=job_id)
    updates["updated_at"] = now_iso()
    await db[COLLECTION].update_one({"id": job_id}, {"$set": updates})
    return await db[COLLECTION].find_one({"id": job_id}, {"_id": 0})


async def hapus(job_id: str) -> dict:
    dipakai = await db.applications.count_documents({"job_id": job_id})
    if dipakai:
        raise HTTPException(
            status_code=409,
            detail=f"Lowongan ini sudah punya {dipakai} lamaran. "
                   f"Ubah statusnya jadi 'Tutup' saja, jangan dihapus.",
        )
    hasil = await db[COLLECTION].delete_one({"id": job_id})
    if not hasil.deleted_count:
        raise HTTPException(status_code=404, detail="Lowongan tidak ditemukan")
    return {"ok": True}


async def daftar_admin() -> List[dict]:
    docs = await db[COLLECTION].find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for d in docs:
        d["jumlah_lamaran"] = await db.applications.count_documents({"job_id": d["id"]})
    return docs


def _query_aktif() -> dict:
    """Lowongan yang boleh tampil di portal: berstatus Aktif & belum lewat batas."""
    hari_ini = today_str()
    return {"status": AKTIF, "$or": [
        {"batas_lamaran": {"$in": ["", None]}},
        {"batas_lamaran": {"$exists": False}},
        {"batas_lamaran": {"$gte": hari_ini}},
    ]}


async def daftar_publik() -> List[dict]:
    docs = await db[COLLECTION].find(_query_aktif(), {"_id": 0}).sort(
        "created_at", -1).to_list(200)
    return [publik(d) for d in docs]


async def ambil_publik(slug: str) -> dict:
    doc = await db[COLLECTION].find_one({**_query_aktif(), "slug": slug}, {"_id": 0})
    if not doc:
        # Pesan sama untuk "tidak ada" dan "sudah tutup" — jangan bocorkan
        # keberadaan lowongan yang belum/tidak dipublikasikan.
        raise HTTPException(status_code=404, detail="Lowongan tidak ditemukan atau sudah ditutup")
    return doc
