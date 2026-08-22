// Penyesuaian khusus form kandidat.
//
// Daftar field & grupnya datang dari backend (/api/meta). File ini hanya
// mengatur hal-hal yang murni urusan tampilan:
//   TESTID_OVERRIDES  data-testid yang harus tetap sama demi test otomatis
//   VISIBLE_WHEN      field yang hanya muncul pada kondisi tertentu
//   FIELD_WARNINGS    peringatan yang muncul di bawah field

// Default data-testid: `${prefix}-${key berganti - }` dengan prefix
// select / rating / input sesuai tipe field. Kecuali yang terdaftar di sini.
export const TESTID_OVERRIDES = {
  status_tanda_tangan: "select-status-ttd",
  tanggal_tanda_tangan: "input-tanggal-ttd",
  nilai_wajah: "rating-wajah",
  nilai_komunikasi: "rating-komunikasi",
  nilai_kedisiplinan: "rating-kedisiplinan",
};

export function testIdFor(field) {
  if (TESTID_OVERRIDES[field.key]) return TESTID_OVERRIDES[field.key];
  const prefix = field.type === "select" ? "select" : field.type === "rating" ? "rating" : "input";
  return `${prefix}-${field.key.replace(/_/g, "-")}`;
}

// Label khusus di form (kalau ingin beda dengan label resmi di schema.py).
export const FORM_LABEL_OVERRIDES = {
  apply: "Apply (Posisi)",
  nilai_wajah: "Wajah",
  nilai_komunikasi: "Komunikasi",
  nilai_kedisiplinan: "Kedisiplinan",
  pic_email: "Email PIC (untuk reminder)",
  tanggal_mulai_training: "Tanggal Mulai Training (auto)",
  tanggal_ttd_kontrak: "Tanggal TTD Kontrak (auto)",
  tanggal_habis_kontrak: "Tanggal Habis Kontrak (auto)",
  alasan_blacklist: "Alasan Blacklist / Catatan",
};

// Field yang hanya ditampilkan pada kondisi tertentu. `form` = isi form saat ini.
export const VISIBLE_WHEN = {
  alasan_blacklist: (form) =>
    (form.status_blacklist || "").startsWith("Ya") ||
    form.status_tanda_tangan === "Mengundurkan Setelah TTD" ||
    form.status_kontrak === "Mengundurkan Setelah Kontrak",
};

// Tombol bantu di sebelah input tertentu.
//   label   : teks tombol
//   fetch   : endpoint yang dipanggil untuk mengisi nilai
//   pick    : ambil nilai dari response
//   hideIf  : sembunyikan tombol kalau kondisi ini benar
export const FIELD_ACTIONS = {
  nik: {
    label: "Belum ada NIK",
    title: "Isi NIK sementara yang dijamin unik — ganti kalau KTP sudah ada",
    fetch: "/candidates/nik-sementara",
    pick: (data) => data.nik,
    hideIf: (value) => Boolean(value),
  },
};

// Peringatan yang muncul di dalam grup tertentu.
export const GROUP_WARNINGS = {
  ttd: (form) =>
    form.status_tanda_tangan === "Mengundurkan Setelah TTD"
      ? "Kandidat otomatis masuk **Blacklist** karena mengundurkan diri setelah TTD kesepakatan."
      : null,
  kontrak: (form) =>
    form.status_kontrak === "Mengundurkan Setelah Kontrak"
      ? "Kandidat otomatis masuk **Blacklist** karena mengundurkan diri setelah TTD kontrak."
      : null,
};
