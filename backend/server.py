"""Entry point ASGI — jangan taruh logika di sini.

Perintah menjalankan server tetap sama:
    uvicorn server:app --reload

Kode aplikasi ada di paket `app/`:
    app/config.py        semua environment variable
    app/schema.py        SUMBER TUNGGAL kolom kandidat, status, tab, funnel
    app/models.py        model Pydantic (kandidat dibuat otomatis dari schema)
    app/security.py      password, JWT, dependency auth
    app/db.py            koneksi MongoDB & index
    app/emailing/        pengiriman email, pengaman konten, katalog template
    app/services/        aturan bisnis (auto rules, riwayat, excel, reminder)
    app/routers/         endpoint HTTP per topik
    app/main.py          perakitan FastAPI

Lihat docs/PANDUAN_MODIFIKASI.md untuk resep perubahan yang sering diminta.
"""

from app.main import app

__all__ = ["app"]
