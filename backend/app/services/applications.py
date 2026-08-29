"""Lamaran yang masuk lewat portal publik.

Alurnya: pelamar kirim -> masuk kotak "Lamaran Masuk" (status Baru) -> admin
memeriksa -> Terima (jadi kandidat di Master Data) atau Tolak.

Lamaran sengaja TIDAK langsung jadi kandidat, supaya data yang belum diperiksa
tidak bercampur dengan master data.
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import HTTPException

from ..db import db
from ..schema import STATUS_SETS
from . import files as files_service
from . import nik as nik_service
from .candidates import prepare_new
from .common import now_iso

COLLECTION = "applications"

BARU, DIPROSES, DITERIMA, DITOLAK = "Baru", "Diproses", "Diterima", "Ditolak"

# Berkas yang diminta di form lamaran: (key, label, wajib?)
BERKAS = (
    ("cv", "CV / Daftar Riwayat Hidup", True),
    ("ijazah", "Ijazah", True),
    ("skck", "SKCK", False),
    ("pas_foto", "Pas Foto", True),
    ("ktp", "KTP", True),
)

# Data pelamar yang disalin ke kandidat saat lamaran diterima.
FIELD_PELAMAR = ("nama", "nik", "email", "no_hp", "tanggal_lahir", "alamat",
                 "domisili", "status_pernikahan", "pendidikan_terakhir",
                 "pengalaman_kerja")


async def _nomor_baru() -> str:
    """Nomor lamaran yang mudah dibaca, mis. RKP-2026-0007."""
    tahun = datetime.now(timezone.utc).year
    jumlah = await db[COLLECTION].count_documents({"nomor": {"$regex": f"^RKP-{tahun}-"}})
    return f"RKP-{tahun}-{jumlah + 1:04d}"


async def buat(data: dict, berkas: Dict[str, dict], job: dict) -> dict:
    doc = {k: (data.get(k) or "") for k in FIELD_PELAMAR}
    doc["nik"] = nik_service.normalize(doc["nik"])
    doc.update({
        "id": str(uuid.uuid4()),
        "nomor": await _nomor_baru(),
        "job_id": job["id"],
        "job_judul": job.get("judul", ""),          # disalin: judul bisa berubah
        "job_slug": job.get("slug", ""),
        "berkas": berkas,
        "status": BARU,
        "catatan_admin": "",
        "candidate_id": "",
        "created_at": now_iso(),
    })
    # Catatan internal untuk pemeriksa — TIDAK pernah dikirim ke pelamar.
    pemilik = await nik_service.find_owner(doc["nik"]) if doc["nik"] else None
    doc["nik_sudah_terdaftar"] = bool(pemilik)
    await db[COLLECTION].insert_one(doc)
    doc.pop("_id", None)
    return doc


async def daftar(status: Optional[str] = None, page: int = 1,
                 per_page: int = 25) -> dict:
    query = {"status": status} if status else {}
    total = await db[COLLECTION].count_documents(query)
    page = max(1, page)
    items = await db[COLLECTION].find(query, {"_id": 0}).sort(
        "created_at", -1).skip((page - 1) * per_page).limit(per_page).to_list(per_page)
    return {"items": items, "total": total, "page": page, "per_page": per_page,
            "pages": max(1, -(-total // per_page))}


async def hitung_per_status() -> Dict[str, int]:
    hasil = {s: 0 for s in STATUS_SETS["status_lamaran"]}
    async for row in db[COLLECTION].aggregate(
            [{"$group": {"_id": "$status", "n": {"$sum": 1}}}]):
        if row["_id"] in hasil:
            hasil[row["_id"]] = row["n"]
    return hasil


async def ambil(app_id: str) -> dict:
    doc = await db[COLLECTION].find_one({"id": app_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Lamaran tidak ditemukan")
    return doc


async def ubah_status(app_id: str, status: str, catatan: str, user: dict) -> dict:
    if status not in STATUS_SETS["status_lamaran"]:
        raise HTTPException(status_code=400, detail="Status lamaran tidak valid")
    await ambil(app_id)
    await db[COLLECTION].update_one({"id": app_id}, {"$set": {
        "status": status,
        "catatan_admin": catatan or "",
        "diproses_oleh": user.get("email", ""),
        "diproses_pada": now_iso(),
    }})
    return await ambil(app_id)


async def terima(app_id: str, user: dict) -> dict:
    """Ubah lamaran jadi kandidat di Master Data."""
    lamaran = await ambil(app_id)
    if lamaran.get("candidate_id"):
        raise HTTPException(status_code=409,
                            detail="Lamaran ini sudah pernah dijadikan kandidat")

    nik = lamaran.get("nik") or ""
    if nik:
        pemilik = await nik_service.find_owner(nik)
        if pemilik:
            raise HTTPException(
                status_code=409,
                detail=nik_service.duplicate_message(pemilik),
            )
    else:
        nik = await nik_service.generate_temporary()

    data = {k: lamaran.get(k, "") for k in FIELD_PELAMAR}
    data["nik"] = nik
    data["apply"] = lamaran.get("job_judul", "")
    data["keterangan"] = f"Dari portal lowongan — lamaran {lamaran['nomor']}"
    doc = prepare_new(data, user)
    doc["lamaran_id"] = app_id
    doc["berkas"] = lamaran.get("berkas", {})       # berkas ikut ke kandidat
    await db.candidates.insert_one(doc)

    await db[COLLECTION].update_one({"id": app_id}, {"$set": {
        "status": DITERIMA,
        "candidate_id": doc["id"],
        "diproses_oleh": user.get("email", ""),
        "diproses_pada": now_iso(),
    }})
    return {k: v for k, v in doc.items() if k != "_id"}


async def hapus(app_id: str) -> dict:
    lamaran = await ambil(app_id)
    jumlah = await files_service.hapus_banyak(
        [(b or {}).get("id") for b in (lamaran.get("berkas") or {}).values()])
    await db[COLLECTION].delete_one({"id": app_id})
    return {"ok": True, "berkas_dihapus": jumlah}
