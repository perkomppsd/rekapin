# Rekapin — HR Recruitment Master Data (PRD)

## Original Problem Statement
App to simplify recruitment data recap. Master Data → auto-filtered to Interview/Training/Blacklist/Placement. Blacklist auto-flow.

## Architecture
- Backend: FastAPI + Motor (MongoDB), JWT+bcrypt auth, openpyxl (Excel), email via HTTP provider yang dikonfigurasi (EMAIL_API_URL), cron platform
- Frontend: React 19 + react-router-dom, shadcn/ui dark, sonner, lucide
- Multi-tenant: Admin sees all; Recruiter sees own (created_by) + assigned (pic_email)

## User Personas
- Admin (Wardah): manages all data, users, custom fields
- Recruiter (PIC): input & manage own candidates
- Hasan: external notifiee (auto email on new hires)

## Core Requirements
- Master Data with 25+ fields (personal, address, ratings, TTD, training, blacklist, custom)
- 5 tabs: Master Data, Interview, Training, Blacklist, Placement
- Funnel chart: Apply → Interview → TTD → Training → Placement with drop-off %
- Auto rules: TTD-Mengundurkan → blacklist; status_training=Training → set start date
- Emails: manual templates (Panggilan Tes / Interview / Lolos & TTD / Reminder) + auto on status change + auto notify Hasan on placement/TTD Sudah
- Cron reminder H-7 & H-0 for 3-month training completion
- Bulk import (paste TSV), Upload .xlsx, Export .xlsx
- Star ratings 1-5: wajah, komunikasi, kedisiplinan
- Kolom kustom (text/number/select) admin-managed
- Date range filter + Tanggal Input column
- Per-candidate history + Manajemen User admin page

## Implemented
### v1 (MVP)
- JWT login, candidate CRUD, 4 tabs, dark UI, export
### v2
- Native date input, Email field, Bulk paste TSV, blacklist reason
### v3
- Upload .xlsx, Timeline feed + per-candidate history, TTD auto-blacklist, PIC email, tanggal_mulai_training auto, Resend + platform cron reminder
### v4 (current)
- Funnel Chart with drop-off analytics
- Multi-user (Admin/Recruiter) with tenancy filter (pic_email normalized)
- Custom fields (text/number/select) via /settings
- Star ratings (wajah/komunikasi/kedisiplinan)
- Email templates (4) + auto on transitions + Hasan notify on hire
- Date-range filter + Tanggal Input column + Alamat column
- Timeline tab removed (per-candidate history retained)

## Backlog
- P1: PDF profil kandidat 1-halaman
- P1: Charts per PIC (individual recruiter performance)
- P2: Split server.py into routers (auth/users/candidates/email/cron)
- P2: SLA reminders (interview overdue)

### v5 (refactor: siap dimodifikasi)
- `backend/server.py` dipecah jadi paket `app/` (config, schema, models, security, db, emailing, services, routers, main)
- `app/schema.py` jadi sumber tunggal: kolom kandidat, status, tab, funnel → model Pydantic, kolom export, pemetaan import, label riwayat semuanya diturunkan dari sini
- Endpoint baru `GET /api/meta` mengirim skema ke frontend; form & tabel frontend jadi data-driven (tidak ada lagi daftar field/status/tab yang disalin di frontend)
- Template email jadi katalog deklaratif (`app/emailing/templates.py`), auto rules & pemicu email otomatis jadi daftar deklaratif
- Frontend: `src/config/` (theme, tableViews, tabPredicates, formFields, statusTones, navigation, icons) + `MetaContext`
- 35 unit test baru (`backend/tests/test_schema_unit.py`) mengunci konsistensi schema — tanpa perlu server hidup
- Dokumentasi: `docs/PANDUAN_MODIFIKASI.md` (resep perubahan) + README
- Backlog P2 "Split server.py into routers" → SELESAI

### v6 (NIK sebagai kunci identitas)
- Field `nik` (NIK/KTP, 16 digit) ditambahkan: `unique=True`, `searchable=True`, `sensitive=True`
- Partial unique index di MongoDB — hanya NIK non-kosong yang wajib unik, jadi kandidat tanpa NIK tetap bisa disimpan
- Duplikat NIK ditolak dengan pesan yang menyebut nama pemilik + peringatan kalau orang itu ada di blacklist (pelamar ulang langsung terdeteksi)
- Import massal & upload Excel melewati baris bermasalah (NIK invalid / dobel di file / sudah ada di DB) dan melaporkannya, tanpa menggagalkan seluruh file
- NIK dinormalisasi otomatis: "3201 0112.3456 7890" -> "3201011234567890"; alias header import: nik, no ktp, ktp, nomor ktp, no. ktp
- `paste_index` NIK diletakkan di posisi terakhir supaya sheet paste 10 kolom yang sudah ada tidak bergeser
- Kotak pencarian dashboard kini membaca `searchable_fields` dari /api/meta (bukan daftar hardcoded)
- Semua jejak Emergent dihapus (branding, script analitik/PostHog, dependency build, proxy email jadi konfigurasi `EMAIL_API_URL`)
- Unit test: 35 -> 59
