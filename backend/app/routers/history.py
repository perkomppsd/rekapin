"""Riwayat perubahan kandidat.

Riwayat mengikuti aturan akses yang sama dengan kandidatnya: admin melihat
semua, recruiter hanya melihat riwayat kandidat miliknya / yang di-PIC-kan.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from .. import config
from ..db import db
from ..security import get_current_user
from ..services import scope

router = APIRouter(prefix="/candidates", tags=["history"])

DEFAULT_LIMIT = 200
MAX_LIMIT = 500


async def _visible_candidate_ids(user: dict) -> Optional[List[str]]:
    """id kandidat yang boleh dilihat user. None = semua (admin)."""
    if scope.is_admin(user):
        return None
    docs = await db.candidates.find(
        scope.query_filter(user), {"id": 1, "_id": 0}
    ).to_list(config.QUERY_LIMIT)
    return [d["id"] for d in docs]


@router.get("/history")
async def history_recent(limit: int = DEFAULT_LIMIT, user: dict = Depends(get_current_user)):
    limit = max(1, min(int(limit or DEFAULT_LIMIT), MAX_LIMIT))
    allowed = await _visible_candidate_ids(user)
    query = {} if allowed is None else {"candidate_id": {"$in": allowed}}
    return await db.candidate_history.find(query, {"_id": 0}).sort(
        "changed_at", -1
    ).to_list(limit)


@router.get("/{candidate_id}/history")
async def history_for_candidate(candidate_id: str, user: dict = Depends(get_current_user)):
    candidate = await db.candidates.find_one({"id": candidate_id}, {"_id": 0})
    if not candidate:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan")
    scope.assert_can_view(candidate, user)
    return await db.candidate_history.find(
        {"candidate_id": candidate_id}, {"_id": 0}
    ).sort("changed_at", -1).to_list(MAX_LIMIT)
