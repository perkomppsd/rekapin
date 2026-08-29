"""Kelola lowongan kerja (admin)."""

from fastapi import APIRouter, Depends, File, UploadFile

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


@router.post("/{job_id}/poster")
async def unggah_poster(job_id: str, file: UploadFile = File(...),
                        admin: dict = Depends(require_admin)):
    """Poster/flyer lowongan. Berbeda dengan berkas lamaran: poster ditandai
    publik supaya bisa tampil di portal tanpa login."""
    return await jobs.set_poster(job_id, file)


@router.delete("/{job_id}/poster")
async def hapus_poster(job_id: str, admin: dict = Depends(require_admin)):
    return await jobs.hapus_poster(job_id)


@router.delete("/{job_id}")
async def hapus(job_id: str, admin: dict = Depends(require_admin)):
    return await jobs.hapus(job_id)
