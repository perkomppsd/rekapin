"""Export Excel / CSV. Kolomnya diatur di app/schema.py (EXPORT_COLUMNS & EXPORT_PRESETS)."""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from .. import config
from ..db import db
from ..security import get_current_user
from ..services import excel, listing

router = APIRouter(prefix="/candidates", tags=["export"])

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
CSV_MIME = "text/csv"


@router.get("/export")
async def export_excel(
    user: dict = Depends(get_current_user),
    scope: str = Query("all"),
    q: str = "",
    position: str = "",
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    preset: str = Query("full"),
    format: str = Query("xlsx"),
    ids: Optional[str] = Query(None),
):
    """Export mengikuti tab & filter yang sedang aktif di layar, preset kolom, dan format."""
    query = listing.build_query(user, scope=scope, q=q, position=position,
                                date_from=date_from, date_to=date_to)
    
    if ids and ids.strip():
        id_list = [i.strip() for i in ids.split(",") if i.strip()]
        if id_list:
            query["id"] = {"$in": id_list}

    docs = await db.candidates.find(query, {"_id": 0}).sort(
        "created_at", -1
    ).to_list(config.QUERY_LIMIT)
    
    if format.lower() == "csv":
        stream, filename = excel.build_export_csv(docs, scope, preset=preset)
        mime = CSV_MIME
    else:
        stream, filename = excel.build_export_workbook(docs, scope, preset=preset)
        mime = XLSX_MIME

    return StreamingResponse(
        stream,
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
