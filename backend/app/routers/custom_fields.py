"""Kolom kustom yang dibuat admin dari halaman Setting."""

import re
import uuid

from fastapi import APIRouter, Depends, HTTPException

from ..db import db
from ..models import CustomFieldCreate
from ..security import get_current_user, require_admin
from ..services.common import now_iso

router = APIRouter(prefix="/custom-fields", tags=["custom-fields"])

ALLOWED_TYPES = ("text", "number", "select")
MAX_FIELDS = 50


def _slugify(s: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")
    return s or f"field_{uuid.uuid4().hex[:6]}"


@router.get("")
async def list_custom_fields(user: dict = Depends(get_current_user)):
    return await db.custom_fields.find({}, {"_id": 0}).sort("created_at", 1).to_list(MAX_FIELDS)


@router.post("")
async def create_custom_field(payload: CustomFieldCreate, admin: dict = Depends(require_admin)):
    if payload.type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Type harus text/number/select")
    key = _slugify(payload.label)
    if await db.custom_fields.find_one({"key": key}):
        key = f"{key}_{uuid.uuid4().hex[:4]}"
    doc = {
        "id": str(uuid.uuid4()),
        "key": key,
        "label": payload.label,
        "type": payload.type,
        "options": payload.options or [],
        "created_at": now_iso(),
    }
    await db.custom_fields.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/{field_id}")
async def delete_custom_field(field_id: str, admin: dict = Depends(require_admin)):
    result = await db.custom_fields.delete_one({"id": field_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Field tidak ditemukan")
    return {"ok": True}
