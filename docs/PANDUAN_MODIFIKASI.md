# Panduan Modifikasi — Rekapin HR Recruitment

Dokumen ini berisi **resep** untuk perubahan yang paling sering diminta.
Prinsipnya: satu perubahan = satu tempat.

---

## Peta kode

```
backend/
  server.py                 entry point ASGI (uvicorn server:app) — tanpa logika
  app/
    config.py               SEMUA environment variable
    schema.py               ⭐ SUMBER TUNGGAL: kolom kandidat, status, tab, funnel
    models.py               model Pydantic (model kandidat dibuat dari schema.py)
    security.py             password, JWT, dependency auth
    db.py                   koneksi MongoDB & index
    emailing/
      templates.py          ⭐ isi & teks email
      sender.py             pengiriman + layout pembungkus
      guard.py              pengaman konten email (jangan dilonggarkan)
    services/
      rules.py              ⭐ aturan otomatis saat simpan
      notifications.py      ⭐ email otomatis saat status berubah
      reminders.py          job reminder training
      excel.py              import & export Excel
      history.py            riwayat perubahan
      scope.py              hak akses admin vs recruiter
      candidates.py         helper dokumen kandidat
      common.py             utility waktu
    routers/                endpoint HTTP per topik (+ meta.py untuk frontend)
    main.py                 perakitan FastAPI

frontend/src/
  config/
    theme.js                ⭐ token kelas Tailwind (warna, tombol, panel)
    tableViews.js           ⭐ kolom tabel per tab
    tabPredicates.js        filter kandidat per tab di browser
    formFields.js           label & kondisi tampil khusus di form
    statusTones.js          warna badge status
    navigation.js           menu header
    icons.js                nama ikon -> komponen lucide
  context/
    AuthContext.jsx         sesi login
    MetaContext.jsx         ambil skema dari GET /api/meta
  components/
    CandidateForm.jsx       form generik (digambar dari /api/meta)
    FieldInput.jsx          satu input generik per tipe field
    CandidateTable.jsx      tabel generik (kolom dari tableViews.js)
    AppHeader.jsx           header dashboard
    AdminPageShell.jsx      kerangka halaman admin
  pages/                    Dashboard, Login, UsersPage, SettingsPage
```

**Kunci utamanya:** frontend mengambil daftar field, status, tab, dan template
email dari backend lewat `GET /api/meta`. Jadi menambah kolom atau status
**cukup di `backend/app/schema.py`** — form, tabel, dropdown, dan export ikut
berubah sendiri.

---

## Resep 1 — Menambah kolom kandidat baru

Contoh: menambah kolom "Sumber Lamaran" berupa dropdown.

1. Buka `backend/app/schema.py`, tambah satu entri di `STATUS_SETS`
   (kalau butuh pilihan):

   ```python
   STATUS_SETS = {
       ...
       "sumber": ["Instagram", "JobStreet", "Referensi", "Walk-in"],
   }
   ```

2. Tambah satu `FieldSpec` di tuple `FIELDS` (posisinya menentukan urutan
   kolom di file export):

   ```python
   FieldSpec("sumber_lamaran", "Sumber Lamaran", type="select", group="pribadi",
             options="sumber", aliases=("sumber", "sumber info")),
   ```

3. Selesai. Yang otomatis ikut:
   - form tambah/edit kandidat (dropdown, di grup "Data Pribadi")
   - kolom di file export Excel
   - pengenalan header saat import Excel (`Sumber Lamaran`, `sumber`, `sumber info`)
   - pencatatan di riwayat perubahan
   - `GET /api/meta` untuk frontend

4. Opsional: kalau kolom ini juga mau muncul di tabel dashboard, tambah satu
   baris di `frontend/src/config/tableViews.js`:

   ```js
   master: [
     ...
     { key: "sumber_lamaran" },
   ],
   ```

> Kalau kolomnya hanya kebutuhan sementara / per-tim, jangan ubah kode:
> pakai menu **Setting → Kolom Kustom** di aplikasi.

### Tipe field yang tersedia
`text`, `email`, `textarea`, `number`, `date`, `time`, `select`, `rating`
(bintang 1–5). Menambah tipe baru: tambah satu renderer di
`frontend/src/components/FieldInput.jsx` dan satu pemetaan tipe Python di
`PY_TYPE_OF` (`app/schema.py`) kalau bukan string.

---

## Resep 2 — Menambah / mengubah pilihan status

Semua pilihan status ada di `STATUS_SETS` di `backend/app/schema.py`.

```python
"interview": [Interview.NOT_CALLED, Interview.CALLED, ..., "Cadangan"],
```

- Kalau status baru itu **hanya pilihan tambahan**, cukup tambahkan stringnya.
- Kalau status baru **dipakai oleh logika** (memicu email, masuk tab tertentu,
  dst), tambahkan juga konstantanya di kelas yang sesuai (`Interview`, `Ttd`,
  `Training`, `Blacklist`) supaya tidak ada string berserakan di kode:

  ```python
  class Interview:
      ...
      RESERVE = "Cadangan"
  ```

Warna badge di tabel diatur di `frontend/src/config/statusTones.js`.

---

## Resep 2b — Membuat kolom jadi unik (tidak boleh dobel)

Set `unique=True` pada `FieldSpec`. Contoh yang sudah dipakai: **NIK (KTP)**.

```python
FieldSpec("nik", "NIK (KTP)", group="pribadi", searchable=True, unique=True,
          sensitive=True, aliases=("no ktp", "ktp"), paste_index=10),
```

Yang otomatis ikut aktif:

- **Partial unique index** di MongoDB (`app/db.py` membacanya dari
  `UNIQUE_FIELDS`). Disebut *partial* karena hanya nilai **non-kosong** yang
  wajib unik — kandidat yang NIK-nya belum dikumpulkan tetap bisa disimpan,
  dan banyak kandidat boleh sama-sama kosong.
- Penolakan saat create/update dengan pesan yang menyebut **siapa** pemilik
  nilai tersebut, plus peringatan kalau orang itu ada di **blacklist**.
- Import massal & upload Excel **melewati** baris bermasalah dan melaporkannya,
  bukan menggagalkan seluruh file.

Validasi format khusus NIK ada di `app/services/nik.py` (16 digit, spasi/titik/
strip otomatis dibersihkan).

**NIK wajib diisi.** Untuk kandidat yang KTP-nya belum dikumpulkan, tersedia
**NIK sementara**: tombol "Belum ada NIK" di form memanggil
`GET /api/candidates/nik-sementara` dan mengisi nomor berawalan `9999`
(bukan kode wilayah yang sah, jadi tidak mungkin bentrok dengan NIK asli),
dijamin belum dipakai. Di tabel nomor ini tampil dengan label "sementara".
Baris import tanpa NIK diberi NIK sementara otomatis, dan jumlahnya dilaporkan.

Data lama yang NIK-nya kosong bisa diisi sekali jalan:
`cd backend && .venv/bin/python scripts/isi_nik_sementara.py` Kalau menambah field unik lain yang butuh format
khusus, tiru pola file itu.

### Kolom hasil hitungan (tidak disimpan)

Umur adalah contohnya: yang disimpan hanya `tanggal_lahir`, umurnya dihitung
setiap kali ditampilkan supaya tidak pernah basi.

- Export: tambah entri di `COMPUTED_COLUMNS` (`app/services/excel.py`)
- Tabel: tambah entri di `SPECIAL_CELLS` (`frontend/src/components/CandidateTable.jsx`)
  dan pakai key berawalan `__` di `config/tableViews.js`
- Form: keterangan yang ikut berubah diatur di `DYNAMIC_HINTS`
  (`frontend/src/config/formFields.js`)

`searchable=True` membuat field ikut dicari kotak pencarian dashboard.
`sensitive=True` menandai data pribadi — jangan masukkan field ini ke template
email.

### Kenapa NIK bukan primary key?

Primary key kandidat tetap `id` (UUID). NIK dipakai sebagai **kunci bisnis**
yang unik, bukan primary key, karena:

- NIK bisa salah ketik dan perlu dikoreksi — mengubah primary key akan
  memutus relasi ke riwayat perubahan (`candidate_history.candidate_id`).
- Kandidat sering masuk database sebelum NIK-nya dikumpulkan.

Efek praktisnya sama: satu NIK = satu kandidat, dan pelamar ulang langsung
terdeteksi.

---

## Resep 3 — Menambah tab baru di dashboard

Contoh: tab "Cadangan".

1. `backend/app/schema.py` — tambah predikat + entri `TABS`:

   ```python
   def is_reserve(c: dict) -> bool:
       return _norm(c.get("status_interview")) == _norm(Interview.RESERVE)

   TABS = (
       ...
       StageSpec("cadangan", "Cadangan", is_reserve, "ClipboardList", "amber"),
   )
   ```

   `query` WAJIB diisi dan harus sepadan dengan `predicate` — dipakai untuk
   listing & hitungan di database. Kesepadanannya dijaga otomatis oleh
   `tests/test_stage_queries.py`, jadi kalau keliru test akan gagal:

   ```python
   StageSpec("cadangan", "Cadangan", is_reserve, "ClipboardList", "amber",
             query={"status_interview": re.compile("^Cadangan$", re.I)}),
   ```

   Ini otomatis membuat: tab baru, kartu statistik baru, filter server-side,
   dan `GET /api/candidates/export?scope=cadangan`.

2. `frontend/src/config/tableViews.js` — tentukan kolom tabelnya:

   ```js
   cadangan: [
     { key: "nama", variant: "primary" },
     { key: "apply" },
     { key: "status_interview", label: "Status" },
     { key: "pic" },
   ],
   ```

Kalau langkah 2 dilewat, tab tetap jalan dan memakai kolom `master`.
Frontend tidak perlu tahu cara memfilter — server yang mengerjakan.

---

## Resep 4 — Mengubah isi / menambah template email

Semua teks email ada di `backend/app/emailing/templates.py`.

- **Mengubah kata-kata**: edit langsung string `subject` / `body`.
- **Menambah template**: tambah satu `TemplateSpec`. Template langsung muncul
  di dropdown "Kirim Email" di aplikasi (frontend membacanya dari `/api/meta`).

  ```python
  TemplateSpec(
      id="penolakan",
      label="Pemberitahuan Tidak Lolos",
      subject="[Hasil Seleksi] $posisi — $nama",
      body=(
          '<h2 style="margin:0 0 4px">Hasil Seleksi</h2>'
          '<p>Halo $nama,</p>'
          '<p>Terima kasih sudah mengikuti proses seleksi untuk posisi '
          '<strong>$posisi</strong>. ...</p>'
      ),
  ),
  ```

Placeholder yang tersedia (`$nama`, `$posisi`, `$tanggal`, `$jam`, `$metode`,
`$penempatan`, ...) didaftar di komentar paling atas file itu. Semua nilai
sudah di-escape HTML.

Aturan keamanan email di `emailing/guard.py` tetap berlaku: tidak boleh ada
form/input, link harus `https://` absolut, dan email tidak boleh meminta
password atau data kartu. Jangan dilonggarkan.

---

## Resep 4b — Menambah jenis reminder baru

`backend/app/services/reminders.py`, tambah satu `ReminderRule`:

```python
ReminderRule(
    key="masa_percobaan",
    label="Masa Percobaan Berakhir",
    date_field="tanggal_mulai_percobaan",
    period_days=30,          # 0 kalau field-nya sudah berisi tanggal tenggat
    only_if=lambda c: (c.get("status_training") or "") == "Percobaan",
),
```

Reminder baru otomatis ikut di email yang sama (satu bagian per jenis per hari
pengingat). Hari pengingat diatur di `config.REMINDER_DAYS` (default H-7 & hari-H).

Yang sudah terpasang: akhir masa **training** (`TRAINING_PERIOD_DAYS`, 90 hari)
dan **habis kontrak** (`tanggal_habis_kontrak`, dihitung dari
`CONTRACT_PERIOD_DAYS`, 180 hari).

---

## Resep 5 — Menambah aturan otomatis saat simpan

`backend/app/services/rules.py`, tambah satu `Rule`:

```python
Rule(
    name="Tidak lulus interview -> kosongkan jadwal",
    when=lambda b, i: became(b, i, "status_interview", Interview.FAILED),
    then=lambda b, i: {"tanggal_interview": "", "jam_interview": ""},
),
```

Helper yang tersedia: `value_of` (nilai setelah update), `became` (berubah
menjadi nilai tertentu), `still_empty`.

Untuk normalisasi nilai (mis. selalu huruf kecil), tambah entri di
`NORMALIZERS` di file yang sama.

---

## Resep 6 — Menambah email otomatis saat status berubah

`backend/app/services/notifications.py`, tambah satu `Trigger`:

```python
Trigger(
    name="Tidak lulus -> kirim pemberitahuan",
    when=lambda b, a: _changed_to(b, a, "status_interview", Interview.FAILED),
    template="penolakan",
),
```

`notify_internal=True` dipakai kalau yang perlu dikabari adalah tim internal
(alamatnya dari `HASAN_EMAIL` di environment).

---

## Resep 7 — Menambah endpoint / halaman baru

**Backend**
1. Buat `backend/app/routers/nama_topik.py` dengan `router = APIRouter(prefix="/...")`.
2. Daftarkan di `ROUTERS` di `backend/app/main.py`.
   Urutan penting: path statis (`/candidates/export`) harus terdaftar sebelum
   path berparameter (`/candidates/{candidate_id}`).

**Frontend**
1. Buat `frontend/src/pages/NamaHalaman.jsx` (pakai `AdminPageShell` kalau
   halaman admin).
2. Tambah entri di `ROUTES` di `frontend/src/App.js`.
3. Tambah entri di `NAV_LINKS` di `frontend/src/config/navigation.js` supaya
   muncul di menu header.

---

## Resep 8 — Mengubah tampilan / warna

Semua kelas Tailwind yang dipakai berulang ada di
`frontend/src/config/theme.js`:

- `T.btnPrimary`, `T.btnOutline`, `T.btnDanger` — tombol
- `T.input`, `T.selectContent` — form
- `T.panel`, `T.panelSubtle`, `T.dialog` — wadah
- `TONES` — warna aksen (indigo/amber/emerald/rose/sky/neutral) untuk kartu
  statistik, badge, dan tombol beraksen

Ganti warna tema cukup di file ini. **Catatan Tailwind:** jangan menyusun nama
kelas dari variabel (`` `md:grid-cols-${n}` ``) karena tidak terdeteksi saat
build — pakai peta string lengkap seperti `GRID_COLS` di `CandidateForm.jsx`.

---

## Resep 9 — Mengubah konfigurasi / environment

Semua environment variable dibaca **hanya** di `backend/app/config.py`.
Menambah setting baru: tambah satu baris di sana, lalu pakai
`config.NAMA_SETTING`.

Yang wajib ada di `backend/.env`:

| Variable | Keterangan |
|---|---|
| `MONGO_URL`, `DB_NAME` | koneksi database |
| `JWT_SECRET` | kunci token login |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | akun admin yang dibuat saat startup |
| `EMAIL_API_URL`, `EMAIL_API_KEY` | endpoint & kunci provider email (kosong = email tidak dikirim, hanya dicatat di log) |
| `EMAIL_API_KEY_HEADER` | nama header untuk API key (default `X-Email-Key`) |
| `EMAIL_FROM_NAME`, `PUBLIC_APP_URL` | identitas & link di email |
| `HASAN_EMAIL`, `HASAN_NAME` | penerima notifikasi internal kandidat diterima |
| `WEBHOOK_CRON_SECRET` | token untuk `POST /api/cron/training-reminder` |
| `CORS_ORIGINS` | daftar origin frontend, dipisah koma |
| `LOCAL_UTC_OFFSET_HOURS` | zona waktu kantor untuk filter "tanggal input" (default `7` = WIB) |
| `ADMIN_PASSWORD_RESET` | set `true` SEKALI kalau password admin lupa; selain itu password yang diganti dari halaman User tidak akan ditimpa saat restart |

Frontend hanya perlu `REACT_APP_BACKEND_URL` di `frontend/.env`.

Parameter bisnis (masa training 90 hari, hari reminder H-7/H-0, batas query)
ada di bagian "Aturan bisnis" di `config.py`.

---

## Menjalankan & menguji

```bash
# backend
cd backend && uvicorn server:app --reload --port 8001

# frontend
cd frontend && yarn install && yarn start

# unit test (tanpa server, cepat)
cd backend && pytest tests/test_schema_unit.py tests/test_stage_queries.py

# test integrasi (butuh server + MongoDB hidup)
cd backend && pytest tests/test_rekapin_backend.py
```

`tests/test_schema_unit.py` mengunci konsistensi schema (field unik, default
status valid, urutan kolom export, aturan otomatis, render template, import
Excel). **Jalankan test ini setiap kali mengubah `app/schema.py`** — kalau
lulus, kemungkinan besar perubahan Anda aman.
