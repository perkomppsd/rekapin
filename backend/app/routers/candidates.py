"""CRUD kandidat + statistik & funnel.

Kolom, tab, dan tahapan funnel tidak di-hardcode di sini — semuanya dibaca
dari app/schema.py.
"""

from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile

from .. import config, schema
from ..db import db
from ..models import BulkImportRequest, Candidate, CandidateCreate, CandidateUpdate
from ..security import get_current_user
from ..services import excel, history, nik as nik_service, scope
from ..services.candidates import prepare_new, split_by_nik
from ..services.common import now_iso
from ..services.notifications import on_candidate_change
from ..services.rules import apply_auto_rules

router = APIRouter(prefix="/candidates", tags=["candidates"])


async def _visible(user: dict, extra_filter: Optional[dict] = None) -> List[dict]:
    query = scope.query_filter(user)
    if extra_filter:
        query.update(extra_filter)
    return await db.candidates.find(query, {"_id": 0}).sort(
        "created_at", -1
    ).to_list(config.QUERY_LIMIT)


# ---------- Listing ----------
@router.get("", response_model=List[Candidate])
async def list_candidates(
    user: dict = Depends(get_current_user),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    date_q = {}
    if date_from:
        date_q["$gte"] = f"{date_from}T00:00:00+00:00"
    if date_to:
        date_q["$lte"] = f"{date_to}T23:59:59+00:00"
    return await _visible(user, {"created_at": date_q} if date_q else None)


@router.get("/funnel")
async def funnel_stats(user: dict = Depends(get_current_user)):
    docs = await _visible(user)

    def pct(cur: int, prev: int) -> float:
        return round((cur / prev) * 100, 1) if prev else 0.0

    stages, previous = [], None
    for key, label, predicate in schema.FUNNEL:
        count = len(docs) if predicate is None else sum(1 for d in docs if predicate(d))
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
    docs = await _visible(user)
    return {
        "total": len(docs),
        **{tab.key: sum(1 for d in docs if tab.matches(d))
           for tab in schema.TABS if tab.predicate is not None},
    }


# ---------- Create ----------
@router.post("", response_model=Candidate)
async def create_candidate(payload: CandidateCreate, bg: BackgroundTasks,
                           user: dict = Depends(get_current_user)):
    data = payload.model_dump()
    # NIK opsional, tapi kalau diisi harus valid & belum dipakai kandidat lain.
    data["nik"] = await nik_service.assert_available(data.get("nik"))
    doc = prepare_new(data, user)
    await db.candidates.insert_one(doc)
    await history.log(doc["id"], doc["nama"], "created",
                      history.marker("_created", "Dibuat", new=doc["nama"]), user)
    bg.add_task(on_candidate_change, {}, doc)
    return {k: v for k, v in doc.items() if k != "_id"}


async def _insert_import(rows: List[dict], user: dict, action: str, label: str) -> dict:
    """Simpan hasil import: baris dengan NIK bermasalah dilewati & dilaporkan."""
    usable, skipped = await split_by_nik(rows)
    stamp = now_iso()
    docs = [prepare_new(row, user, stamp) for row in usable]
    if docs:
        await db.candidates.insert_many(docs)
        await history.log_many(docs, action, label, user, stamp)
    return {"inserted": len(docs), "skipped": len(skipped), "duplicates": skipped}


@router.post("/bulk")
async def bulk_create(payload: BulkImportRequest, user: dict = Depends(get_current_user)):
    rows = [item.model_dump() for item in payload.items]
    return await _insert_import(rows, user, "imported", "Import Massal")


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
    await history.log(candidate_id, existing.get("nama", ""), "deleted",
                      history.marker("_deleted", "Dihapus", old=existing.get("nama", "")), user)
    return {"ok": True}
