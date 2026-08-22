"""Riwayat perubahan kandidat."""

from fastapi import APIRouter, Depends

from ..db import db
from ..security import get_current_user

router = APIRouter(prefix="/candidates", tags=["history"])

DEFAULT_LIMIT = 200
MAX_LIMIT = 500


@router.get("/history")
async def history_recent(limit: int = DEFAULT_LIMIT, user: dict = Depends(get_current_user)):
    limit = max(1, min(int(limit or DEFAULT_LIMIT), MAX_LIMIT))
    return await db.candidate_history.find({}, {"_id": 0}).sort(
        "changed_at", -1
    ).to_list(limit)


@router.get("/{candidate_id}/history")
async def history_for_candidate(candidate_id: str, user: dict = Depends(get_current_user)):
    return await db.candidate_history.find(
        {"candidate_id": candidate_id}, {"_id": 0}
    ).sort("changed_at", -1).to_list(MAX_LIMIT)
