"""Export Excel. Kolomnya diatur di app/schema.py (EXPORT_COLUMNS)."""

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from .. import config
from ..db import db
from ..schema import filter_by_scope
from ..security import get_current_user
from ..services import excel, scope as tenancy

router = APIRouter(prefix="/candidates", tags=["export"])

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get("/export")
async def export_excel(scope: str = "all", user: dict = Depends(get_current_user)):
    docs = await db.candidates.find(
        tenancy.query_filter(user), {"_id": 0}
    ).sort("created_at", -1).to_list(config.QUERY_LIMIT)
    stream, filename = excel.build_export_workbook(filter_by_scope(docs, scope), scope)
    return StreamingResponse(
        stream,
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
