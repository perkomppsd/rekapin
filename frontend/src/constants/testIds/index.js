// constants/testIds/ — daftar terpusat nilai data-testid yang dipakai agen
// pengujian otomatis untuk menemukan & mengoperasikan elemen UI.
// UI tanpa testid tidak bisa diverifikasi otomatis.
//
// Struktur: tiap fitur punya file sendiri (auth.js, dst) dan di-re-export dari
// sini, sehingga pemakai bisa satu kali import:
// `import { LOGIN } from '@/constants/testIds'`
//
// Menambah fitur baru:
//   1. Buat constants/testIds/<fitur>.js
//   2. Export object bernama (mis. `export const PROFILE = { ... }`)
//   3. Re-export di sini: `export * from './<fitur>';`
//
// Catatan: testid untuk form & tabel kandidat TIDAK didaftar di sini karena
// dibuat otomatis dari schema — lihat src/config/formFields.js (testIdFor)
// dan src/config/tableViews.js.

export * from './auth';
