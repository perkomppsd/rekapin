"""Portal lowongan — SATU-SATUNYA bagian aplikasi yang bisa diakses tanpa login.

Prinsip yang dijaga di sini:
  * Hanya mengirim data yang memang untuk publik (daftar putih field di
    services/jobs.py), tidak pernah data kandidat/user.
  * Balasan ke pelamar selalu sama, apa pun kondisi internalnya. NIK yang sudah
    terdaftar atau masuk blacklist TIDAK boleh ketahuan dari sini — itu bocoran
    data internal ke orang luar.
  * Ada batas jumlah kiriman per IP.
"""

from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from .. import config
from ..schema import STATUS_SETS
from ..services import applications, files, jobs, ratelimit
from ..services.candidates import assert_valid_birthdate
from ..services.nik import reject_reason

router = APIRouter(prefix="/publik", tags=["portal"])


@router.get("/lowongan")
async def daftar_lowongan():
    return await jobs.daftar_publik()


@router.get("/lowongan/{slug}")
async def detail_lowongan(slug: str):
    return jobs.publik(await jobs.ambil_publik(slug))


@router.get("/form-lamaran")
async def info_form():
    """Info untuk menggambar form: berkas apa saja & pilihan dropdown."""
    return {
        "berkas": [{"key": k, "label": label, "wajib": wajib}
                   for k, label, wajib in applications.BERKAS],
        "max_file_mb": config.MAX_FILE_MB,
        "tipe_diterima": files.ALLOWED_LABEL,
        "pilihan": {
            "status_pernikahan": STATUS_SETS["pernikahan"],
            "pendidikan_terakhir": STATUS_SETS["pendidikan"],
        },
    }


@router.post("/lamaran")
async def kirim_lamaran(
    request: Request,
    slug: str = Form(...),
    nama: str = Form(...),
    nik: str = Form(...),
    email: str = Form(""),
    no_hp: str = Form(...),
    tanggal_lahir: str = Form(...),
    alamat: str = Form(...),
    domisili: str = Form(""),
    status_pernikahan: str = Form(""),
    pendidikan_terakhir: str = Form(""),
    pengalaman_kerja: str = Form(""),
    cv: UploadFile = File(...),
    ijazah: UploadFile = File(...),
    pas_foto: UploadFile = File(...),
    ktp: UploadFile = File(...),
    skck: Optional[UploadFile] = File(None),
):
    ratelimit.check(request, limit=config.PUBLIC_RATE_LIMIT,
                    window_minutes=config.PUBLIC_RATE_WINDOW_MINUTES)

    job = await jobs.ambil_publik(slug)

    if not nama.strip():
        raise HTTPException(status_code=400, detail="Nama wajib diisi")
    if not no_hp.strip():
        raise HTTPException(status_code=400, detail="Nomor HP wajib diisi")
    alasan_nik = reject_reason(nik)
    if alasan_nik or not nik.strip():
        raise HTTPException(status_code=400, detail=alasan_nik or "NIK wajib diisi")
    assert_valid_birthdate(tanggal_lahir)
    for field, nilai, set_name in (
        ("Status pernikahan", status_pernikahan, "pernikahan"),
        ("Pendidikan terakhir", pendidikan_terakhir, "pendidikan"),
    ):
        if nilai and nilai not in STATUS_SETS[set_name]:
            raise HTTPException(status_code=400, detail=f"{field} tidak valid")

    unggahan = {"cv": cv, "ijazah": ijazah, "pas_foto": pas_foto, "ktp": ktp}
    if skck is not None and skck.filename:
        unggahan["skck"] = skck

    berkas = {}
    try:
        for key, upload in unggahan.items():
            label = next(l for k, l, _ in applications.BERKAS if k == key)
            berkas[key] = await files.simpan(upload, kategori=label)
    except Exception:
        # Jangan tinggalkan berkas yatim kalau ada satu yang gagal.
        await files.hapus_banyak([b.get("id") for b in berkas.values()])
        raise

    lamaran = await applications.buat({
        "nama": nama.strip(), "nik": nik, "email": email.strip(),
        "no_hp": no_hp.strip(), "tanggal_lahir": tanggal_lahir,
        "alamat": alamat.strip(), "domisili": domisili.strip(),
        "status_pernikahan": status_pernikahan,
        "pendidikan_terakhir": pendidikan_terakhir,
        "pengalaman_kerja": pengalaman_kerja.strip(),
    }, berkas, job)

    # Balasan sengaja seragam — tidak menyebut apakah NIK sudah terdaftar.
    return {
        "ok": True,
        "nomor": lamaran["nomor"],
        "pesan": "Lamaran Anda sudah kami terima. Simpan nomor lamaran ini "
                 "untuk keperluan komunikasi selanjutnya.",
    }
