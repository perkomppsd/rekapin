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

### v7 (perbaikan keamanan + paginasi)
- FIX: riwayat perubahan bocor antar-recruiter — `/candidates/history` & `/candidates/{id}/history` sekarang mengikuti aturan akses kandidat (admin semua, recruiter hanya miliknya)
- FIX: password admin tidak lagi ter-reset dari .env setiap restart; reset hanya bila `ADMIN_PASSWORD_RESET=true`
- FIX: `/api/cron/training-reminder` menolak (503) kalau `WEBHOOK_CRON_SECRET` kosong — sebelumnya header 'Bearer ' bisa lolos
- FIX: panjang password minimum (8) divalidasi di backend, bukan hanya di form
- FIX: filter "tanggal input" memakai zona waktu lokal (`LOCAL_UTC_OFFSET_HOURS`, default WIB) — sebelumnya input 00:00-07:00 WIB masuk ke tanggal sebelumnya
- Paginasi + filter server-side: `GET /api/candidates?scope=&q=&position=&date_from=&date_to=&page=&per_page=` mengembalikan `{items, total, page, pages, per_page}`; batas keras 5.000 kandidat hilang
- Statistik & funnel pakai `count_documents` (bukan menarik semua dokumen); endpoint baru `/candidates/positions`
- StageSpec dapat `query` Mongo sepadan `predicate`; kesepadanannya dijaga `tests/test_stage_queries.py`
- Export mengikuti tab & filter yang aktif di layar
- `config/tabPredicates.js` dihapus — filter tab tidak lagi diduplikasi di frontend
- Unit test: 59 -> 84

### v8 (NIK wajib)
- NIK jadi wajib (`required=True`); simpan tanpa NIK -> 422
- NIK sementara untuk kandidat yang KTP-nya belum ada: awalan 9999 (bukan kode wilayah sah), dijamin unik, tampil berlabel "sementara" di tabel
- Tombol "Belum ada NIK" di form (config/formFields.js -> FIELD_ACTIONS) memanggil GET /candidates/nik-sementara
- Import: baris tanpa NIK diberi NIK sementara otomatis (`auto_nik` dilaporkan ke UI), jadi sheet lama tanpa kolom NIK tetap bisa masuk
- BulkImportRequest.items jadi List[dict] + validasi per baris -> satu baris rusak tidak lagi menggagalkan seluruh paste (422)
- Script migrasi backend/scripts/isi_nik_sementara.py untuk data lama
- Unit test: 84 -> 89

### v9 (TTD Kontrak 6 bulan)
- Istilah dibedakan: "TTD Kesepakatan" (awal) vs "TTD Kontrak" (bulan ke-6). Nama field internal tidak berubah (status_tanda_tangan), jadi tanpa migrasi data
- Field baru: status_kontrak, tanggal_ttd_kontrak, tanggal_habis_kontrak (grup "TTD Kontrak (6 Bulan)")
- Status kontrak: Belum / Sudah / Diperpanjang / Tidak Dilanjutkan / Mengundurkan Setelah Kontrak
- Auto-rule: status "Sudah" -> tanggal TTD kontrak = hari ini; tanggal habis = TTD + CONTRACT_PERIOD_DAYS (180)
- Auto-rule: "Mengundurkan Setelah Kontrak" -> blacklist "Ya - Mengundurkan Setelah Kontrak"
- Tab + kartu statistik + scope export "kontrak"; funnel dapat tahap "TTD Kontrak" di akhir
- reminders.py digeneralisasi jadi daftar ReminderRule: reminder training (H-90) & habis kontrak (tanggal habis), satu email dua bagian
- Alias import lama ("Status TTD", "Tanggal TTD") tetap dikenali
- FIX: /api/meta error 500 karena FUNNEL kini 4 elemen
- Unit test: 89 -> 105

### v10 (usia -> tanggal lahir)
- Kolom `usia` (angka statis, jadi basi) diganti `tanggal_lahir`; umur dihitung on-the-fly di tabel, form, dan export
- Auto-rule: tanggal lahir terisi otomatis dari NIK (digit 7-12 = DDMMYY, perempuan DD+40). Dilewati kalau NIK sementara atau tanggalnya tidak wajar (umur di luar 15-70)
- Validasi: tanggal lahir tidak boleh di masa depan / umur tak wajar / format salah
- Form menampilkan "Umur sekarang: N tahun" yang ikut berubah saat tanggal diisi (DYNAMIC_HINTS di config/formFields.js)
- Export tetap punya kolom USIA, tapi hasil hitungan (COMPUTED_COLUMNS di services/excel.py); data lama tanpa tanggal lahir memakai nilai usia tersimpan sebagai cadangan
- Slot posisi import ke-4 dipakai ulang (usia -> tanggal lahir) supaya sheet paste tidak bergeser; alias: tanggal lahir, tgl lahir, dob, birth date
- Script backfill scripts/isi_tanggal_lahir.py (dry run default, --tulis untuk simpan) -> 6 dari 7 kandidat contoh terisi dari NIK
- Unit test: 105 -> 126

### v11 (data master Unit Usaha & Jobdesk)
- Mekanisme "daftar referensi" generik: schema.REFERENCE_LISTS + FieldSpec.options_ref
- Dua daftar terpasang: Unit Usaha (rencana_penempatan, penempatan_fix) & Jobdesk (apply, posisi_penempatan, posisi_fix)
- CRUD lengkap: GET/POST/PUT/DELETE /api/references/{list_key} (tulis = admin), item punya nama + keterangan (Jobdesk: uraian tugas)
- Kolom penempatan & posisi kandidat berubah dari teks bebas jadi dropdown yang diisi dari daftar
- Ganti nama item -> nilai di data kandidat ikut diperbarui otomatis (tidak ada nilai yatim)
- Hapus item -> hilang dari dropdown tapi data kandidat tidak diubah; di form nilai lama tampil "(tidak ada di daftar)"
- Tiap item menampilkan jumlah pemakaian; konfirmasi hapus memperingatkan kalau masih dipakai
- Nama unik per daftar (index reference_list_nama_unique)
- Halaman Setting jadi "Data Master": kartu pengelola per daftar (ReferenceListManager, generik) + kolom kustom
- Script scripts/isi_daftar_referensi.py menyerap nilai teks bebas yang sudah ada (9 item terserap dari data contoh)
- Unit test: 126 -> 132

### v12 (PIC dipilih dari daftar user)
- Field `pic` jadi dropdown dari daftar user (FieldSpec.options_source="users"), bukan teks bebas
- Memilih PIC otomatis mengisi `pic_email` (LINKED_FIELDS di config/formFields.js); pic_email jadi tampil-saja (DERIVED_FIELDS) supaya tidak bisa berbeda dari PIC-nya
- Alasan: pic_email menentukan hak akses recruiter & penerima reminder — typo bikin recruiter kehilangan akses tanpa error
- Endpoint baru GET /api/users/options (nama + email saja, boleh diakses semua user login); GET /api/users lengkap tetap admin-only
- services/candidates.py -> fill_pic_email(): baris import yang hanya berisi nama PIC dilengkapi emailnya dari akun user yang cocok (dilaporkan sebagai auto_pic)
- Diuji: import "pic: Rina Recruiter" tanpa email -> pic_email terisi -> Rina langsung melihat kandidatnya
- Unit test: 132 -> 133 (dua test lama yang tercakup test baru dihapus)

### v13 (pengurutan kolom)
- Mekanisme sort generik: FieldSpec.sortable + SORTS/SortSpec di schema.py; endpoint `GET /candidates?sort=&order=`
- Judul kolom di tabel jadi tombol (klik = turun, klik lagi = naik), dengan indikator arah
- Sort dikerjakan database, jadi mengurutkan seluruh data bukan hanya halaman yang tampil
- Kolom Nilai: rata-rata sekarang DISIMPAN di field `nilai_rata` (auto rule, dihitung ulang tiap simpan) supaya bisa diurutkan & di-index; nilai 0 dipakai untuk "belum dinilai" agar urutan konsisten
- Sort `usia` memakai `tanggal_lahir` dengan `invert=True` (umur terbesar = tanggal paling lampau)
- Sort key tak dikenal jatuh ke default (created_at desc), tidak error; respons mengembalikan sort yang benar-benar dipakai
- Urutan kedua selalu created_at desc supaya hasil stabil saat nilainya sama
- Export dapat kolom NILAI RATA-RATA
- Script scripts/isi_nilai_rata.py untuk data lama (7 kandidat diperbarui)
- Unit test: 133 -> 141

### v14 (tab TTD Kesepakatan + layout ringkasan)
- Tab & kartu statistik "TTD Kesepakatan" ditambahkan (predikat has_signed & Q_SIGNED sudah ada, dipakai funnel) — ikon Handshake, warna teal
- Urutan tab disesuaikan alur proses: Master, Interview, TTD Kesepakatan, Training, Placement, TTD Kontrak, Blacklist (blacklist terakhir karena status terminal)
- Kolom tabel khusus tab ttd (tanggal & status TTD kesepakatan + status kontrak)
- Layout dashboard: kartu statistik (kiri, 2/5) sejajar funnel (kanan, 3/5) mulai layar xl; keduanya dipadatkan, hemat ~500px tinggi halaman
- Klik baris tabel = buka form edit (tidak terpicu saat menyorot teks / klik menu aksi); bisa lewat Enter/Space
- Urutan dropdown metode interview: Offline sebelum Online
- Unit test: 141 -> 142

### v15 (portal lowongan & lamaran mandiri)
- Portal karier PUBLIK (tanpa login): /lowongan (daftar) & /lowongan/:slug (detail + form lamaran)
- Admin bisa memasang lowongan: judul, jobdesk, unit usaha, tipe kerja, kuota, batas lamaran, deskripsi, persyaratan; status Draft/Aktif/Tutup (hanya Aktif & belum lewat batas yang tampil publik)
- Form lamaran: nama, NIK, HP, email, tanggal lahir (umur dihitung), alamat KTP, domisili, status pernikahan, pendidikan terakhir, pengalaman kerja
- Upload berkas: CV, ijazah, pas foto, KTP (wajib) + SKCK (opsional)
- Field kandidat baru: domisili, status_pernikahan, pendidikan_terakhir, pengalaman_kerja
- Alur: lamaran masuk kotak "Lamaran Masuk" (Baru) -> admin periksa -> Terima (jadi kandidat + berkas ikut) / Tolak
- KEAMANAN: berkas TIDAK bisa diakses lewat URL publik (hanya GET /api/berkas/{id} yang cek login); tipe file diperiksa dari magic bytes bukan nama/header; batas 5MB per berkas; rate limit 5 lamaran/jam per IP; balasan ke pelamar seragam sehingga status blacklist/NIK terdaftar tidak bocor ke luar
- Penanda internal nik_sudah_terdaftar muncul di kotak lamaran untuk pemeriksa
- Lowongan yang sudah punya lamaran tidak bisa dihapus (harus ditutup)
- Unit test: 142 -> 156

### v16 (poster lowongan + tema terang/gelap)
- Poster/flyer lowongan bisa diunggah & diganti admin (JPG/PNG saja), tampil di kartu & detail portal publik
- Berkas bertanda publik=True punya endpoint sendiri GET /api/publik/poster/{id} (tanpa login); berkas lamaran TIDAK pernah bertanda publik jadi tetap tertutup — diuji: KTP lewat endpoint poster -> 404
- Ganti/hapus poster & hapus lowongan ikut membersihkan file lama dari disk
- Tema terang/gelap: ThemeContext (kelas `dark` di <html>, disimpan di localStorage, default ikut setelan sistem) + tombol di semua header
- Warna disapu jadi pasangan terang/gelap di 22 file + warna aksen disesuaikan agar terbaca di latar putih; glass-nav & tekstur noise punya versi per tema
- Unit test: 156 -> 159

### v17 (perbaikan siklus hidup berkas + rate limit login)
- FIX: berkas kini punya pemilik tunggal (pemilik_tipe/pemilik_id). Sebelumnya rujukan berkas disalin saat lamaran diterima, sehingga menghapus lamaran ikut menghapus CV/KTP milik kandidat (rujukan jadi rusak)
- Lamaran diterima -> kepemilikan berkas DIPINDAH ke kandidat (files.pindah_pemilik)
- FIX: menghapus kandidat kini ikut menghapus dokumen pribadinya (KTP/ijazah/SKCK) dari server; sebelumnya file tetap tersimpan setelah data "dihapus"
- FIX: login kini dibatasi 10 percobaan GAGAL per IP / 15 menit (LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_MINUTES); login yang berhasil tidak memakan kuota
- ratelimit.py dipisah jadi ensure()/record() + namespace, jadi hitungan login & lamaran publik tidak bercampur
- Test HTTP baru tests/test_http_publik.py (20 test): endpoint internal wajib login, field internal tidak bocor, lowongan Draft tersembunyi, balasan lamaran seragam, KTP tidak bisa diambil lewat endpoint poster, siklus hidup berkas, rate limit login
- Unit test: 159 -> 182

### v18 (login Google)
- Login staf HR memakai akun Google (Google Identity Services). Verifikasi ID token di backend pakai kunci publik Google (JWKS) — tidak perlu client secret
- Yang diperiksa: tanda tangan, aud (client id), iss, exp, email_verified. Semua diuji dengan kunci RSA buatan sendiri di tests/test_google_auth.py
- Google hanya membuktikan IDENTITAS; izin masuk tetap dari daftar user aplikasi (email belum terdaftar -> 403)
- Login password DIMATIKAN secara default (PASSWORD_LOGIN=false); endpoint /auth/login balas 403 dengan arahan pakai Google
- GET /auth/config (publik) memberi tahu frontend cara login yang aktif; halaman login menyesuaikan sendiri
- Rate limit login berlaku juga untuk jalur Google (email tak terdaftar dihitung sebagai kegagalan)
- JALUR DARURAT: backend/scripts/akses_darurat.py (lihat kondisi, daftar user, jadikan admin, set password) + PASSWORD_LOGIN=true sementara. Didokumentasikan di docs/PANDUAN_MODIFIKASI.md
- CATATAN: .env lokal masih PASSWORD_LOGIN=true karena GOOGLE_CLIENT_ID belum diisi; ubah ke false setelah login Google terbukti jalan
- FIX: sapuan tema sebelumnya menghasilkan kelas ganda (mis. "text-slate-400 dark:text-slate-600 dark:text-slate-300") di 13 file — diperbaiki
- Unit test: 182 -> 194
