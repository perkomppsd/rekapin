"""Export Excel. Kolomnya diatur di app/schema.py (EXPORT_COLUMNS)."""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from .. import config
from ..db import db
from ..security import get_current_user
from ..services import excel, listing

router = APIRouter(prefix="/candidates", tags=["export"])

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get("/export")
async def export_excel(
    user: dict = Depends(get_current_user),
    scope: str = Query("all"),
    q: str = "",
    position: str = "",
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    """Export mengikuti tab & filter yang sedang aktif di layar."""
    query = listing.build_query(user, scope=scope, q=q, position=position,
                                date_from=date_from, date_to=date_to)
    docs = await db.candidates.find(query, {"_id": 0}).sort(
        "created_at", -1
    ).to_list(config.QUERY_LIMIT)
    stream, filename = excel.build_export_workbook(docs, scope)
    return StreamingResponse(
        stream,
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
