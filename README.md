# Rekapin — HR Recruitment Master Data

Aplikasi rekap data rekrutmen: input sekali di **Master Data**, lalu tab
Interview / Training / Blacklist / Placement mengikuti otomatis. Dilengkapi
funnel rekrutmen, email template ke kandidat, import/export Excel, riwayat
perubahan, multi-user (Admin / Recruiter), dan reminder training 3 bulan.

- **Backend**: FastAPI + MongoDB (Motor), JWT + bcrypt, openpyxl, email via proxy Resend
- **Frontend**: React 19 + react-router, shadcn/ui (tema gelap), Tailwind, sonner

## Menjalankan

```bash
# backend (butuh backend/.env — lihat daftar variabel di docs/PANDUAN_MODIFIKASI.md)
cd backend && pip install -r requirements.txt && uvicorn server:app --reload --port 8001

# frontend (butuh frontend/.env berisi REACT_APP_BACKEND_URL)
cd frontend && yarn install && yarn start
```

## Struktur singkat

```
backend/app/schema.py       ⭐ sumber tunggal kolom kandidat, status, tab, funnel
backend/app/emailing/       template & pengiriman email
backend/app/services/       aturan bisnis (auto rules, excel, riwayat, reminder)
backend/app/routers/        endpoint HTTP (termasuk /api/meta untuk frontend)
frontend/src/config/        tema, kolom tabel, filter tab, menu
frontend/src/context/       sesi login + skema dari /api/meta
```

Frontend mengambil definisi field, status, tab, dan template email dari
`GET /api/meta`. Artinya **menambah kolom atau status cukup diubah di
`backend/app/schema.py`** — form, tabel, dropdown, dan export ikut menyesuaikan.

## Mau mengubah sesuatu?

Baca **[docs/PANDUAN_MODIFIKASI.md](docs/PANDUAN_MODIFIKASI.md)** — berisi resep
langkah demi langkah untuk: menambah kolom, menambah status, menambah tab,
mengubah teks email, menambah aturan otomatis, menambah endpoint/halaman, dan
mengubah tema warna.

## Test

```bash
cd backend
pytest tests/test_schema_unit.py      # cepat, tanpa server — jalankan setiap ubah schema.py
pytest tests/test_rekapin_backend.py  # integrasi, butuh server + MongoDB hidup
```
