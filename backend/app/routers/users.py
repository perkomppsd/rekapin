"""Manajemen user (khusus admin)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException

from ..db import db
from ..models import UserCreate, UserUpdate
from ..schema import STATUS_SETS
from ..security import hash_password, require_admin
from ..services.common import now_iso

router = APIRouter(prefix="/users", tags=["users"])

ROLES = tuple(STATUS_SETS["role"])
MAX_USERS = 200


def _assert_valid_role(role: str) -> None:
    if role not in ROLES:
        raise HTTPException(status_code=400, detail="Role tidak valid")


@router.get("")
async def list_users(admin: dict = Depends(require_admin)):
    return await db.users.find(
        {}, {"_id": 0, "password_hash": 0}
    ).sort("created_at", 1).to_list(MAX_USERS)


@router.post("")
async def create_user(payload: UserCreate, admin: dict = Depends(require_admin)):
    email = payload.email.lower().strip()
    _assert_valid_role(payload.role)
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": payload.name,
        "role": payload.role,
        "password_hash": hash_password(payload.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    doc.pop("password_hash", None)
    doc.pop("_id", None)
    return doc


@router.put("/{user_id}")
async def update_user(user_id: str, payload: UserUpdate, admin: dict = Depends(require_admin)):
    if not await db.users.find_one({"id": user_id}):
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    updates = {}
    if payload.name is not None:
        updates["name"] = payload.name
    if payload.role is not None:
        _assert_valid_role(payload.role)
        updates["role"] = payload.role
    if payload.password:
        updates["password_hash"] = hash_password(payload.password)
    if updates:
        await db.users.update_one({"id": user_id}, {"$set": updates})
    return await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})


@router.delete("/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus akun sendiri")
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    return {"ok": True}
