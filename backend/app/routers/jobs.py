"""Kelola lowongan kerja (admin)."""

from fastapi import APIRouter, Depends

from ..models import JobPostingCreate, JobPostingUpdate
from ..security import get_current_user, require_admin
from ..services import jobs

router = APIRouter(prefix="/lowongan", tags=["lowongan"])


@router.get("")
async def daftar(user: dict = Depends(get_current_user)):
    return await jobs.daftar_admin()


@router.post("")
async def buat(payload: JobPostingCreate, admin: dict = Depends(require_admin)):
    return await jobs.buat(payload.model_dump(), admin)


@router.put("/{job_id}")
async def ubah(job_id: str, payload: JobPostingUpdate,
               admin: dict = Depends(require_admin)):
    return await jobs.ubah(job_id, payload.model_dump(exclude_unset=True))


@router.delete("/{job_id}")
async def hapus(job_id: str, admin: dict = Depends(require_admin)):
    return await jobs.hapus(job_id)
