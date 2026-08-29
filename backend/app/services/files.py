"""Penyimpanan berkas lamaran (CV, ijazah, SKCK, pas foto, KTP).

Aturan yang dijaga di sini:
  * Berkas TIDAK pernah bisa diakses lewat URL publik. Disimpan di luar folder
    static, nama file diacak, dan hanya bisa diunduh lewat endpoint ber-otentikasi.
  * Tipe diperiksa dari ISI file (magic bytes), bukan dari nama atau header yang
    dikirim browser — keduanya gampang dipalsukan.
  * Ada batas ukuran per berkas.
"""

import uuid
from pathlib import Path
from typing import Dict, Optional, Tuple

from fastapi import HTTPException, UploadFile

from .. import config
from ..db import db
from .common import now_iso

COLLECTION = "files"

# Tipe yang diterima: (ekstensi, mime) -> dikenali dari magic bytes.
SIGNATURES: Tuple[Tuple[bytes, str, str], ...] = (
    (b"%PDF-", ".pdf", "application/pdf"),
    (b"\xff\xd8\xff", ".jpg", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", ".png", "image/png"),
)

ALLOWED_LABEL = "PDF, JPG, atau PNG"
GAMBAR_SAJA = (".jpg", ".png")
GAMBAR_LABEL = "JPG atau PNG"


def _sniff(head: bytes) -> Optional[Tuple[str, str]]:
    for signature, ext, mime in SIGNATURES:
        if head.startswith(signature):
            return ext, mime
    return None


async def simpan(upload: UploadFile, *, kategori: str, keterangan: str = "",
                 ekstensi_diizinkan: Optional[tuple] = None,
                 publik: bool = False) -> dict:
    """Validasi & simpan satu berkas. Return metadata untuk disimpan di dokumen.

    publik=True HANYA untuk berkas yang memang boleh dilihat siapa saja
    (mis. poster lowongan). Berkas lamaran tidak pernah memakai ini.
    """
    isi = await upload.read()
    if not isi:
        raise HTTPException(status_code=400, detail=f"Berkas {kategori} kosong")
    if len(isi) > config.MAX_FILE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"Berkas {kategori} lebih dari {config.MAX_FILE_MB} MB "
                   f"({len(isi) / 1024 / 1024:.1f} MB)",
        )
    jenis = _sniff(isi[:16])
    if jenis is None:
        raise HTTPException(
            status_code=400,
            detail=f"Berkas {kategori} harus berupa {ALLOWED_LABEL}",
        )
    ext, mime = jenis
    if ekstensi_diizinkan and ext not in ekstensi_diizinkan:
        raise HTTPException(
            status_code=400,
            detail=f"Berkas {kategori} harus berupa {GAMBAR_LABEL}",
        )

    file_id = uuid.uuid4().hex
    folder = config.UPLOAD_DIR / file_id[:2]
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{file_id}{ext}"
    path.write_bytes(isi)

    doc = {
        "id": file_id,
        "kategori": kategori,
        "nama_asli": Path(upload.filename or "berkas").name[:120],
        "mime": mime,
        "ukuran": len(isi),
        "path": str(path),
        "keterangan": keterangan,
        "publik": publik,
        "created_at": now_iso(),
    }
    await db[COLLECTION].insert_one(dict(doc))
    doc.pop("_id", None)
    return {k: v for k, v in doc.items() if k != "path"}


async def ambil_publik(file_id: str) -> Tuple[Path, dict]:
    """Hanya berkas bertanda publik. Dipakai endpoint tanpa login (poster loker).

    Sengaja query-nya menyertakan publik=True, bukan mengecek setelah ambil —
    supaya berkas lamaran mustahil terambil dari sini walau id-nya ditebak.
    """
    doc = await db[COLLECTION].find_one({"id": file_id, "publik": True}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Berkas tidak ditemukan")
    path = Path(doc["path"])
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File sudah tidak ada di server")
    return path, doc


async def ambil(file_id: str) -> Tuple[Path, dict]:
    """Path & metadata berkas. 404 kalau tidak ada / filenya hilang di disk."""
    doc = await db[COLLECTION].find_one({"id": file_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Berkas tidak ditemukan")
    path = Path(doc["path"])
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File sudah tidak ada di server")
    return path, doc


async def hapus_banyak(file_ids) -> int:
    """Hapus berkas dari disk & database (dipakai saat lamaran dihapus)."""
    dihapus = 0
    for fid in [f for f in file_ids if f]:
        doc = await db[COLLECTION].find_one({"id": fid}, {"_id": 0, "path": 1})
        if doc:
            Path(doc["path"]).unlink(missing_ok=True)
            await db[COLLECTION].delete_one({"id": fid})
            dihapus += 1
    return dihapus


def ringkas(berkas: Dict[str, dict]) -> Dict[str, dict]:
    """Buang path dari metadata sebelum dikirim ke frontend."""
    return {k: {kk: vv for kk, vv in (v or {}).items() if kk != "path"}
            for k, v in (berkas or {}).items()}
