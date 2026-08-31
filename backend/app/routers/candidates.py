"""CRUD kandidat + statistik & funnel.

Kolom, tab, dan tahapan funnel tidak di-hardcode di sini — semuanya dibaca
dari app/schema.py.
"""

from typing import List, Optional

from fastapi import (APIRouter, BackgroundTasks, Depends, File, HTTPException, Query,
                     UploadFile)

from .. import config, schema
from ..db import db
from ..models import BulkImportRequest, Candidate, CandidateCreate, CandidateUpdate
from ..security import get_current_user
from ..services import (excel, files as files_service, history, listing,
                       nik as nik_service, scope)
from ..services.candidates import (assert_valid_birthdate, fill_missing_nik,
                                  fill_pic_email, from_import_row, prepare_new,
                                  split_by_nik)
from ..services.common import now_iso
from ..services.notifications import on_candidate_change
from ..services.rules import apply_auto_rules

router = APIRouter(prefix="/candidates", tags=["candidates"])


async def _count(user: dict, stage_query: Optional[dict] = None) -> int:
    """Hitung kandidat di database — tanpa menarik dokumennya."""
    query = listing.build_query(user)
    if stage_query:
        query = {"$and": [query, stage_query]} if query else dict(stage_query)
    return await db.candidates.count_documents(query)


# ---------- Listing ----------
@router.get("")
async def list_candidates(
    user: dict = Depends(get_current_user),
    scope_: str = Query("all", alias="scope"),   # tab: master/interview/training/...
    q: str = "",                                  # kata kunci pencarian
    position: str = "",                           # filter posisi apply
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    per_page: int = config.DEFAULT_PAGE_SIZE,
    sort: str = schema.DEFAULT_SORT,
    order: str = "desc",
):
    """Daftar kandidat berpaginasi. Penyaringan & pengurutan dilakukan database."""
    query = listing.build_query(user, scope=scope_, q=q, position=position,
                                date_from=date_from, date_to=date_to)
    page, per_page, skip = listing.paginate(page, per_page)
    sort_field, sort_dir = schema.sort_tuple(sort, order)
    total = await db.candidates.count_documents(query)
    items = await db.candidates.find(query, {"_id": 0}).sort(
        # Urutan kedua menjaga hasil tetap stabil kalau nilainya sama.
        [(sort_field, sort_dir), ("created_at", -1)]
    ).skip(skip).limit(per_page).to_list(per_page)
    return {"items": items, "sort": schema.resolve_sort(sort),
            "order": "asc" if str(order).lower() == "asc" else "desc",
            **listing.page_meta(total, page, per_page)}


@router.get("/positions")
async def list_positions(user: dict = Depends(get_current_user)):
    """Daftar posisi apply yang ada — untuk mengisi dropdown filter."""
    values = await db.candidates.distinct("apply", listing.build_query(user))
    return sorted(v for v in values if isinstance(v, str) and v.strip())


@router.get("/funnel")
async def funnel_stats(user: dict = Depends(get_current_user)):
    def pct(cur: int, prev: int) -> float:
        return round((cur / prev) * 100, 1) if prev else 0.0

    stages, previous = [], None
    for key, label, _predicate, query in schema.FUNNEL:
        count = await _count(user, query)
        stages.append({
            "key": key,
            "label": label,
            "count": count,
            "conversion": 100.0 if previous is None else pct(count, previous),
            "dropoff": 0.0 if previous is None else max(previous - count, 0),
        })
        previous = count
    return {"stages": stages}


@router.get("/stats")
async def stats(user: dict = Depends(get_current_user)):
    result = {"total": await _count(user)}
    for tab in schema.TABS:
        if tab.query:
            result[tab.key] = await _count(user, tab.query)
    return result


# ---------- Create ----------
@router.post("", response_model=Candidate)
async def create_candidate(payload: CandidateCreate, bg: BackgroundTasks,
                           user: dict = Depends(get_current_user)):
    data = payload.model_dump()
    # NIK opsional, tapi kalau diisi harus valid & belum dipakai kandidat lain.
    data["nik"] = await nik_service.assert_available(data.get("nik"))
    data["tanggal_lahir"] = assert_valid_birthdate(data.get("tanggal_lahir"))
    await fill_pic_email([data])
    doc = prepare_new(data, user)
    await db.candidates.insert_one(doc)
    await history.log(doc["id"], doc["nama"], "created",
                      history.marker("_created", "Dibuat", new=doc["nama"]), user)
    bg.add_task(on_candidate_change, {}, doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/nik-sementara")
async def temporary_nik(user: dict = Depends(get_current_user)):
    """NIK sementara yang belum dipakai — untuk kandidat yang KTP-nya belum ada."""
    return {"nik": await nik_service.generate_temporary()}


async def _insert_import(rows: List[dict], user: dict, action: str, label: str) -> dict:
    """Simpan hasil import: baris bermasalah dilewati & dilaporkan, sisanya masuk."""
    auto_pic = await fill_pic_email(rows)
    auto_nik = await fill_missing_nik(rows)
    usable, skipped = await split_by_nik(rows)
    stamp = now_iso()
    docs = [prepare_new(row, user, stamp) for row in usable]
    if docs:
        await db.candidates.insert_many(docs)
        await history.log_many(docs, action, label, user, stamp)
    return {"inserted": len(docs), "skipped": len(skipped),
            "duplicates": skipped, "auto_nik": auto_nik, "auto_pic": auto_pic}


@router.post("/bulk")
async def bulk_create(payload: BulkImportRequest, user: dict = Depends(get_current_user)):
    # Validasi per baris: baris yang tidak lolos dilewati, bukan menggagalkan semua.
    rows, invalid = [], []
    for raw in payload.items:
        doc = from_import_row(raw)
        if doc is None:
            invalid.append({"nama": str(raw.get("nama") or ""), "nik": str(raw.get("nik") or ""),
                            "alasan": "Data baris tidak valid (nama wajib diisi)"})
        else:
            rows.append(doc)
    result = await _insert_import(rows, user, "imported", "Import Massal")
    result["duplicates"] = invalid + result["duplicates"]
    result["skipped"] += len(invalid)
    return result


@router.post("/upload")
async def upload_excel(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    if not (file.filename or "").lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="File harus .xlsx")
    content = await file.read()
    try:
        rows = excel.parse_workbook(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Gagal membaca file Excel: {e}")

    return await _insert_import(rows, user, "imported", "Import Excel")


@router.get("/import-template")
async def download_import_template(user: dict = Depends(get_current_user)):
    """Unduh template Excel (.xlsx) untuk impor kandidat massal."""
    from fastapi.responses import StreamingResponse
    stream, filename = excel.build_import_template_workbook()
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------- Update & delete ----------
@router.put("/{candidate_id}", response_model=Candidate)
async def update_candidate(candidate_id: str, payload: CandidateUpdate, bg: BackgroundTasks,
                           user: dict = Depends(get_current_user)):
    existing = await db.candidates.find_one({"id": candidate_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan")
    scope.assert_can_edit(existing, user)

    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "nik" in updates:
        updates["nik"] = await nik_service.assert_available(updates["nik"], exclude_id=candidate_id)
    if "tanggal_lahir" in updates:
        updates["tanggal_lahir"] = assert_valid_birthdate(updates["tanggal_lahir"])
    updates = apply_auto_rules(existing, updates)
    updates["updated_at"] = now_iso()
    await db.candidates.update_one({"id": candidate_id}, {"$set": updates})
    updated = await db.candidates.find_one({"id": candidate_id}, {"_id": 0})

    diffs = history.diff(existing, updated)
    if diffs:
        await history.log(candidate_id, updated["nama"], "updated", diffs, user)
    bg.add_task(on_candidate_change, existing, updated)
    return updated


@router.delete("/{candidate_id}")
async def delete_candidate(candidate_id: str, user: dict = Depends(get_current_user)):
    existing = await db.candidates.find_one({"id": candidate_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan")
    scope.assert_can_delete(existing, user)
    await db.candidates.delete_one({"id": candidate_id})
    # Dokumen pribadi (KTP, ijazah, SKCK) ikut dihapus dari server. Menyimpan
    # scan identitas setelah datanya dihapus tidak bisa dibenarkan.
    berkas_dihapus = await files_service.hapus_milik("kandidat", candidate_id)
    await history.log(candidate_id, existing.get("nama", ""), "deleted",
                      history.marker("_deleted", "Dihapus", old=existing.get("nama", "")), user)
    return {"ok": True, "berkas_dihapus": berkas_dihapus}


VALID_BERKAS_CATEGORIES = ("cv", "ijazah", "skck", "pas_foto", "ktp")


@router.post("/{candidate_id}/berkas/{kategori}")
async def upload_candidate_file(candidate_id: str, kategori: str, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """Upload / ganti berkas kandidat (CV, KTP, Ijazah, Pas Foto, SKCK)."""
    kategori = kategori.lower().strip()
    if kategori not in VALID_BERKAS_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Kategori berkas tidak valid. Pilih dari: {', '.join(VALID_BERKAS_CATEGORIES)}")
    
    existing = await db.candidates.find_one({"id": candidate_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan")
    scope.assert_can_edit(existing, user)

    # Hapus berkas lama untuk kategori ini jika ada
    old_file = (existing.get("berkas") or {}).get(kategori)
    if old_file and isinstance(old_file, dict) and old_file.get("id"):
        await files_service.hapus_banyak([old_file["id"]])

    # Simpan berkas baru
    meta = await files_service.simpan(
        file, kategori=kategori, pemilik_tipe="kandidat", pemilik_id=candidate_id
    )

    await db.candidates.update_one(
        {"id": candidate_id},
        {"$set": {f"berkas.{kategori}": meta, "updated_at": now_iso()}}
    )

    await history.log(
        candidate_id, existing.get("nama", ""), "file_uploaded",
        f"Mengunggah berkas {kategori.upper()} ({file.filename})", user
    )

    updated = await db.candidates.find_one({"id": candidate_id}, {"_id": 0})
    return updated


@router.delete("/{candidate_id}/berkas/{kategori}")
async def delete_candidate_file(candidate_id: str, kategori: str, user: dict = Depends(get_current_user)):
    """Hapus berkas spesifik milik kandidat."""
    kategori = kategori.lower().strip()
    existing = await db.candidates.find_one({"id": candidate_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan")
    scope.assert_can_edit(existing, user)

    old_file = (existing.get("berkas") or {}).get(kategori)
    if old_file and isinstance(old_file, dict) and old_file.get("id"):
        await files_service.hapus_banyak([old_file["id"]])

    await db.candidates.update_one(
        {"id": candidate_id},
        {"$unset": {f"berkas.{kategori}": ""}, "$set": {"updated_at": now_iso()}}
    )

    await history.log(
        candidate_id, existing.get("nama", ""), "file_deleted",
        f"Menghapus berkas {kategori.upper()}", user
    )

    updated = await db.candidates.find_one({"id": candidate_id}, {"_id": 0})
    return updated
