"""Multi-tenant: admin lihat semua, recruiter lihat miliknya sendiri.

Ubah aturan akses di sini saja — dipakai semua endpoint kandidat.
"""

from fastapi import HTTPException

ADMIN = "admin"


def is_admin(user: dict) -> bool:
    return user.get("role") == ADMIN


def query_filter(user: dict) -> dict:
    """Filter Mongo: recruiter hanya melihat kandidat buatannya / yang di-PIC-kan."""
    if is_admin(user):
        return {}
    return {"$or": [
        {"created_by": user["id"]},
        {"pic_email": (user.get("email") or "").lower()},
    ]}


def owns(candidate: dict, user: dict) -> bool:
    """True kalau user pembuat kandidat atau PIC-nya."""
    return (
        candidate.get("created_by") == user["id"]
        or (candidate.get("pic_email") or "").lower() == (user.get("email") or "").lower()
    )


def assert_can_edit(candidate: dict, user: dict) -> None:
    if not is_admin(user) and not owns(candidate, user):
        raise HTTPException(status_code=403, detail="Tidak berhak mengubah kandidat ini")


def assert_can_delete(candidate: dict, user: dict) -> None:
    if not is_admin(user) and candidate.get("created_by") != user["id"]:
        raise HTTPException(
            status_code=403,
            detail="Hanya admin atau pembuat data yang bisa menghapus",
        )


def assert_can_email(candidate: dict, user: dict) -> None:
    if not is_admin(user) and not owns(candidate, user):
        raise HTTPException(status_code=403, detail="Tidak berhak")
