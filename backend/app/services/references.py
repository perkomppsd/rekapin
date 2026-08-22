"""Daftar referensi (Unit Usaha, Jobdesk, dst) — data master yang dikelola admin.

Definisi daftarnya ada di app/schema.py -> REFERENCE_LISTS.
Isinya disimpan di koleksi `reference_items`: satu dokumen per item.
"""

import uuid
from typing import Dict, List, Optional

from fastapi import HTTPException

from ..db import db
from ..schema import REFERENCE_LISTS, ReferenceList
from .common import now_iso

COLLECTION = "reference_items"


def get_list(list_key: str) -> ReferenceList:
    ref = REFERENCE_LISTS.get(list_key)
    if ref is None:
        raise HTTPException(status_code=404, detail=f"Daftar '{list_key}' tidak dikenal")
    return ref


async def names(list_key: str) -> List[str]:
    """Nama item terurut — dipakai untuk mengisi dropdown di form."""
    docs = await db[COLLECTION].find(
        {"list": list_key}, {"_id": 0, "nama": 1}
    ).sort("nama", 1).to_list(1000)
    return [d["nama"] for d in docs]


async def all_names() -> Dict[str, List[str]]:
    return {key: await names(key) for key in REFERENCE_LISTS}


async def usage_counts(list_key: str) -> Dict[str, int]:
    """Berapa kali tiap nilai dipakai di data kandidat (untuk peringatan hapus)."""
    counts: Dict[str, int] = {}
    for field in get_list(list_key).fields:
        pipeline = [{"$group": {"_id": f"${field}", "n": {"$sum": 1}}}]
        async for row in db.candidates.aggregate(pipeline):
            nama = (row["_id"] or "").strip() if isinstance(row["_id"], str) else ""
            if nama:
                counts[nama] = counts.get(nama, 0) + row["n"]
    return counts


async def items(list_key: str, with_usage: bool = True) -> List[dict]:
    get_list(list_key)
    docs = await db[COLLECTION].find(
        {"list": list_key}, {"_id": 0}
    ).sort("nama", 1).to_list(1000)
    if with_usage:
        counts = await usage_counts(list_key)
        for d in docs:
            d["dipakai"] = counts.get(d["nama"], 0)
    return docs


async def _assert_name_free(list_key: str, nama: str, exclude_id: Optional[str] = None) -> None:
    query = {"list": list_key, "nama": nama}
    if exclude_id:
        query["id"] = {"$ne": exclude_id}
    if await db[COLLECTION].find_one(query):
        raise HTTPException(status_code=409,
                            detail=f"\"{nama}\" sudah ada di daftar {get_list(list_key).label}")


async def create(list_key: str, nama: str, keterangan: str = "") -> dict:
    ref = get_list(list_key)
    nama = (nama or "").strip()
    if not nama:
        raise HTTPException(status_code=400, detail=f"Nama {ref.singular.lower()} wajib diisi")
    await _assert_name_free(list_key, nama)
    doc = {
        "id": str(uuid.uuid4()),
        "list": list_key,
        "nama": nama,
        "keterangan": (keterangan or "").strip(),
        "created_at": now_iso(),
    }
    await db[COLLECTION].insert_one(doc)
    doc.pop("_id", None)
    return doc


async def update(list_key: str, item_id: str, nama: Optional[str],
                 keterangan: Optional[str]) -> dict:
    ref = get_list(list_key)
    existing = await db[COLLECTION].find_one({"id": item_id, "list": list_key}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail=f"{ref.singular} tidak ditemukan")

    updates: Dict[str, object] = {}
    nama_baru = (nama or "").strip()
    if nama_baru and nama_baru != existing["nama"]:
        await _assert_name_free(list_key, nama_baru, exclude_id=item_id)
        updates["nama"] = nama_baru
    if keterangan is not None:
        updates["keterangan"] = keterangan.strip()

    if updates:
        await db[COLLECTION].update_one({"id": item_id}, {"$set": updates})
        # Nama berubah -> ikut perbarui data kandidat supaya tidak jadi nilai yatim.
        if "nama" in updates:
            for field in ref.fields:
                await db.candidates.update_many(
                    {field: existing["nama"]}, {"$set": {field: nama_baru}}
                )
    return await db[COLLECTION].find_one({"id": item_id}, {"_id": 0})


async def delete(list_key: str, item_id: str) -> dict:
    ref = get_list(list_key)
    existing = await db[COLLECTION].find_one({"id": item_id, "list": list_key}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail=f"{ref.singular} tidak ditemukan")
    await db[COLLECTION].delete_one({"id": item_id})
    # Nilai di data kandidat SENGAJA tidak dihapus: itu catatan historis.
    # Di form, nilai yang tidak ada lagi di daftar tetap ditampilkan.
    counts = await usage_counts(list_key)
    return {"ok": True, "masih_dipakai": counts.get(existing["nama"], 0)}
