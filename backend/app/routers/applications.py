"""Kotak "Lamaran Masuk" (admin/recruiter) + unduh berkas lamaran."""

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse

from ..models import ApplicationDecision
from ..security import get_current_user
from ..services import applications, files

router = APIRouter(tags=["lamaran"])


@router.get("/lamaran")
async def daftar(status: str = "", page: int = 1, per_page: int = 25,
                 user: dict = Depends(get_current_user)):
    return await applications.daftar(status or None, page, per_page)


@router.get("/lamaran/ringkasan")
async def ringkasan(user: dict = Depends(get_current_user)):
    return await applications.hitung_per_status()


@router.get("/lamaran/{app_id}")
async def detail(app_id: str, user: dict = Depends(get_current_user)):
    return await applications.ambil(app_id)


@router.post("/lamaran/{app_id}/status")
async def ubah_status(app_id: str, payload: ApplicationDecision,
                      user: dict = Depends(get_current_user)):
    return await applications.ubah_status(app_id, payload.status,
                                          payload.catatan or "", user)


@router.post("/lamaran/{app_id}/terima")
async def terima(app_id: str, user: dict = Depends(get_current_user)):
    """Jadikan kandidat di Master Data."""
    return await applications.terima(app_id, user)


@router.delete("/lamaran/{app_id}")
async def hapus(app_id: str, user: dict = Depends(get_current_user)):
    return await applications.hapus(app_id)


@router.get("/berkas/{file_id}")
async def unduh(file_id: str, user: dict = Depends(get_current_user)):
    """Berkas hanya bisa diunduh oleh user yang sudah login — tidak ada URL publik."""
    path, meta = await files.ambil(file_id)
    return FileResponse(path, media_type=meta["mime"], filename=meta["nama_asli"])
