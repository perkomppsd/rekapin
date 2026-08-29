"""Test HTTP untuk jalur PUBLIK (tanpa login).

Kenapa test ini penting: portal lowongan adalah satu-satunya bagian aplikasi
yang bisa diakses siapa saja. Kalau suatu saat ada perubahan yang tidak sengaja
membuka berkas lamaran (KTP, CV) atau data internal ke publik, test ini gagal.

Butuh MongoDB lokal; kalau tidak ada, seluruh modul di-skip.
Memakai database terpisah supaya data asli tidak tersentuh.
"""

import os
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# HARUS diset sebelum app di-import (app/config.py membacanya saat import).
os.environ["DB_NAME"] = "rekapin_test_http"
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("JWT_SECRET", "test-secret-untuk-pengujian-saja")
os.environ.setdefault("ADMIN_EMAIL", "admin.test@example.com")
os.environ.setdefault("ADMIN_PASSWORD", "rahasia-test-123")
os.environ.setdefault("WEBHOOK_CRON_SECRET", "cron-test")
os.environ["UPLOAD_DIR"] = str(BACKEND_DIR / "uploads_test")

pytest.importorskip("fastapi.testclient")
from fastapi.testclient import TestClient   # noqa: E402

PDF = b"%PDF-1.4 berkas uji"
JPG = b"\xff\xd8\xff\xe0" + b"\x00" * 128
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 128


def _mongo_hidup() -> bool:
    try:
        import pymongo
        pymongo.MongoClient(os.environ["MONGO_URL"],
                            serverSelectionTimeoutMS=1500).admin.command("ping")
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _mongo_hidup(),
                                reason="MongoDB tidak tersedia")


@pytest.fixture(scope="module")
def client():
    from server import app
    with TestClient(app) as c:
        yield c
    # Bersihkan pakai klien SINKRON: app.db memakai motor (async), memanggil
    # drop_database-nya tanpa await hanya menghasilkan coroutine yang tidak jalan.
    import shutil

    import pymongo
    pymongo.MongoClient(os.environ["MONGO_URL"]).drop_database(os.environ["DB_NAME"])
    shutil.rmtree(BACKEND_DIR / "uploads_test", ignore_errors=True)


@pytest.fixture(autouse=True)
def _reset_ratelimit():
    """Rate limit disimpan di memori proses, jadi tanpa reset hitungannya
    terbawa antar-test dan test berikutnya kena 429 yang tidak relevan."""
    from app.services import ratelimit
    ratelimit.reset()
    yield
    ratelimit.reset()


@pytest.fixture(scope="module")
def token(client):
    r = client.post("/api/auth/login", json={
        "email": os.environ["ADMIN_EMAIL"], "password": os.environ["ADMIN_PASSWORD"]})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def lowongan(client, auth):
    r = client.post("/api/lowongan", headers=auth, json={
        "judul": "Kasir Uji Otomatis", "unit_usaha": "Cabang Uji",
        "tipe_kerja": "Full Time", "status": "Aktif"})
    assert r.status_code == 200, r.text
    return r.json()


# ---------------------------------------------------------------------------
# Endpoint publik tidak boleh membocorkan data internal
# ---------------------------------------------------------------------------
def test_daftar_lowongan_bisa_diakses_tanpa_login(client, lowongan):
    r = client.get("/api/publik/lowongan")
    assert r.status_code == 200
    assert any(j["slug"] == lowongan["slug"] for j in r.json())


def test_lowongan_publik_tidak_membocorkan_field_internal(client, lowongan):
    r = client.get(f"/api/publik/lowongan/{lowongan['slug']}")
    assert r.status_code == 200
    data = r.json()
    for terlarang in ("id", "created_by", "created_by_nama", "status", "updated_at"):
        assert terlarang not in data, f"field internal '{terlarang}' bocor ke publik"


def test_lowongan_draft_tidak_terlihat_publik(client, auth):
    r = client.post("/api/lowongan", headers=auth,
                    json={"judul": "Rahasia Belum Terbit", "status": "Draft"})
    slug = r.json()["slug"]
    assert client.get(f"/api/publik/lowongan/{slug}").status_code == 404
    assert all(j["slug"] != slug for j in client.get("/api/publik/lowongan").json())


@pytest.mark.parametrize("path", [
    "/api/candidates", "/api/users", "/api/lamaran", "/api/meta",
    "/api/lowongan", "/api/candidates/stats", "/api/references/unit_usaha",
])
def test_endpoint_internal_wajib_login(client, path):
    assert client.get(path).status_code == 401, f"{path} bisa diakses tanpa login!"


# ---------------------------------------------------------------------------
# Kiriman lamaran & isolasi berkas
# ---------------------------------------------------------------------------
def _kirim_lamaran(client, slug, nik="3201010101990001", **ubah):
    data = {"slug": slug, "nama": "Pelamar Uji", "nik": nik, "no_hp": "081200000000",
            "tanggal_lahir": "1999-01-01", "alamat": "Jl. Uji No. 1"}
    data.update(ubah)
    return client.post("/api/publik/lamaran", data=data, files={
        "cv": ("cv.pdf", PDF, "application/pdf"),
        "ijazah": ("ijazah.pdf", PDF, "application/pdf"),
        "pas_foto": ("foto.jpg", JPG, "image/jpeg"),
        "ktp": ("ktp.jpg", JPG, "image/jpeg"),
    })


def test_lamaran_bisa_dikirim_tanpa_login(client, lowongan):
    r = _kirim_lamaran(client, lowongan["slug"])
    assert r.status_code == 200, r.text
    assert r.json()["nomor"].startswith("RKP-")


def test_balasan_lamaran_tidak_membocorkan_status_internal(client, lowongan):
    """NIK yang sudah terdaftar TIDAK boleh ketahuan dari balasan publik."""
    pertama = _kirim_lamaran(client, lowongan["slug"], nik="3201010101990009")
    kedua = _kirim_lamaran(client, lowongan["slug"], nik="3201010101990009")
    assert pertama.status_code == kedua.status_code == 200
    assert pertama.json()["pesan"] == kedua.json()["pesan"]
    assert "terdaftar" not in kedua.text.lower()
    assert "blacklist" not in kedua.text.lower()


def test_berkas_lamaran_tidak_bisa_diambil_tanpa_login(client, lowongan, auth):
    _kirim_lamaran(client, lowongan["slug"], nik="3201010101990002")
    lam = client.get("/api/lamaran", headers=auth).json()["items"][0]
    ktp_id = lam["berkas"]["ktp"]["id"]

    assert client.get(f"/api/berkas/{ktp_id}").status_code == 401
    assert client.get(f"/api/berkas/{ktp_id}", headers=auth).status_code == 200


def test_ktp_tidak_bisa_diambil_lewat_endpoint_poster(client, lowongan, auth):
    """Pengaman utama: endpoint poster hanya melayani berkas bertanda publik."""
    _kirim_lamaran(client, lowongan["slug"], nik="3201010101990003")
    lam = client.get("/api/lamaran", headers=auth).json()["items"][0]
    for kunci, berkas in lam["berkas"].items():
        r = client.get(f"/api/publik/poster/{berkas['id']}")
        assert r.status_code == 404, f"berkas lamaran '{kunci}' bocor lewat endpoint poster!"


def test_poster_lowongan_bisa_dilihat_publik(client, lowongan, auth):
    r = client.post(f"/api/lowongan/{lowongan['id']}/poster", headers=auth,
                    files={"file": ("poster.png", PNG, "image/png")})
    assert r.status_code == 200, r.text
    poster_id = r.json()["id"]
    tanpa_login = client.get(f"/api/publik/poster/{poster_id}")
    assert tanpa_login.status_code == 200
    assert tanpa_login.headers["content-type"] == "image/png"


def test_berkas_bukan_gambar_ditolak(client, lowongan):
    r = client.post("/api/publik/lamaran", data={
        "slug": lowongan["slug"], "nama": "X", "nik": "3201010101990004",
        "no_hp": "0812", "tanggal_lahir": "1999-01-01", "alamat": "Jl"},
        files={
            "cv": ("virus.pdf", b"MZ\x90\x00 ini executable", "application/pdf"),
            "ijazah": ("i.pdf", PDF, "application/pdf"),
            "pas_foto": ("f.jpg", JPG, "image/jpeg"),
            "ktp": ("k.jpg", JPG, "image/jpeg"),
        })
    assert r.status_code == 400
    assert "PDF, JPG, atau PNG" in r.json()["detail"]


# ---------------------------------------------------------------------------
# Siklus hidup berkas (bug yang pernah terjadi)
# ---------------------------------------------------------------------------
def test_hapus_lamaran_yang_sudah_diterima_tidak_merusak_berkas_kandidat(client, lowongan, auth):
    _kirim_lamaran(client, lowongan["slug"], nik="3201010101990005")
    lam = client.get("/api/lamaran", headers=auth, params={"status": "Baru"}).json()["items"][0]
    ids = [b["id"] for b in lam["berkas"].values()]

    kandidat = client.post(f"/api/lamaran/{lam['id']}/terima", headers=auth).json()
    hapus = client.delete(f"/api/lamaran/{lam['id']}", headers=auth).json()
    assert hapus["berkas_dihapus"] == 0, "berkas milik kandidat ikut terhapus"
    for fid in ids:
        assert client.get(f"/api/berkas/{fid}", headers=auth).status_code == 200

    # Kandidat dihapus -> dokumen pribadinya ikut hilang dari server.
    hapus_kandidat = client.delete(f"/api/candidates/{kandidat['id']}", headers=auth).json()
    assert hapus_kandidat["berkas_dihapus"] == len(ids)
    for fid in ids:
        assert client.get(f"/api/berkas/{fid}", headers=auth).status_code == 404


def test_hapus_lamaran_yang_belum_diterima_ikut_menghapus_berkas(client, lowongan, auth):
    _kirim_lamaran(client, lowongan["slug"], nik="3201010101990006")
    lam = client.get("/api/lamaran", headers=auth, params={"status": "Baru"}).json()["items"][0]
    ids = [b["id"] for b in lam["berkas"].values()]
    hapus = client.delete(f"/api/lamaran/{lam['id']}", headers=auth).json()
    assert hapus["berkas_dihapus"] == len(ids)
    for fid in ids:
        assert client.get(f"/api/berkas/{fid}", headers=auth).status_code == 404


# ---------------------------------------------------------------------------
# Rate limit login
# ---------------------------------------------------------------------------
def test_login_gagal_berulang_kena_rate_limit(client):
    from app import config
    from app.services import ratelimit
    ratelimit.reset()
    try:
        kode = [client.post("/api/auth/login", json={
            "email": os.environ["ADMIN_EMAIL"], "password": f"salah-{i}"}).status_code
            for i in range(config.LOGIN_RATE_LIMIT + 2)]
        assert kode[:config.LOGIN_RATE_LIMIT] == [401] * config.LOGIN_RATE_LIMIT
        assert 429 in kode, "login tidak pernah kena rate limit"
    finally:
        ratelimit.reset()


def test_login_berhasil_tidak_memakan_kuota(client):
    from app import config
    from app.services import ratelimit
    ratelimit.reset()
    try:
        for _ in range(config.LOGIN_RATE_LIMIT + 3):
            r = client.post("/api/auth/login", json={
                "email": os.environ["ADMIN_EMAIL"],
                "password": os.environ["ADMIN_PASSWORD"]})
            assert r.status_code == 200, "login yang benar tidak boleh ikut terkunci"
    finally:
        ratelimit.reset()
