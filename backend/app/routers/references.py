"""CRUD daftar referensi (Unit Usaha, Jobdesk, ...).

Satu router melayani semua daftar yang terdaftar di schema.REFERENCE_LISTS,
jadi menambah daftar baru tidak perlu menambah endpoint.
"""

from fastapi import APIRouter, Depends

from ..models import ReferenceItemCreate, ReferenceItemUpdate
from ..schema import REFERENCE_LISTS
from ..security import get_current_user, require_admin
from ..services import references

router = APIRouter(prefix="/references", tags=["references"])


@router.get("")
async def list_definitions(user: dict = Depends(get_current_user)):
    """Daftar apa saja yang tersedia beserta field kandidat yang memakainya."""
    return [
        {"key": r.key, "label": r.label, "singular": r.singular,
         "description": r.description, "fields": list(r.fields),
         "note_label": r.note_label}
        for r in REFERENCE_LISTS.values()
    ]


@router.get("/{list_key}")
async def list_items(list_key: str, user: dict = Depends(get_current_user)):
    return await references.items(list_key)


@router.post("/{list_key}")
async def create_item(list_key: str, payload: ReferenceItemCreate,
                      admin: dict = Depends(require_admin)):
    return await references.create(list_key, payload.nama, payload.keterangan or "")


@router.put("/{list_key}/{item_id}")
async def update_item(list_key: str, item_id: str, payload: ReferenceItemUpdate,
                      admin: dict = Depends(require_admin)):
    return await references.update(list_key, item_id, payload.nama, payload.keterangan)


@router.delete("/{list_key}/{item_id}")
async def delete_item(list_key: str, item_id: str, admin: dict = Depends(require_admin)):
    return await references.delete(list_key, item_id)
