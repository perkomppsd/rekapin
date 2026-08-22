// Kolom tabel untuk setiap tab.
//
// Tambah / hapus / urutkan ulang kolom cukup di file ini.
//   key      : key field kandidat (atau kolom khusus di bawah)
//   label    : judul kolom (default: label field dari /api/meta)
//   fallback : key pengganti kalau nilai utama kosong
//   variant  : cara menampilkan sel (lihat daftar di bawah)
//   sort     : key pengurutan (lihat SORTS di backend/app/schema.py).
//              Kolom tanpa `sort` tidak bisa diklik untuk diurutkan.
//
// variant yang tersedia:
//   primary  teks utama (nama kandidat)
//   text     teks biasa (default)
//   mutedXs  teks kecil abu
//   mono     teks monospace kecil (no HP, tanggal mentah)
//   truncate dipotong dengan tooltip (alamat)
//   status   badge berwarna (otomatis untuk field status_*)
//   date     tanggal ISO diformat lokal
//
// Kolom khusus (bukan field kandidat):
//   __rating_avg      rata-rata nilai bintang
//   __rating_stack    tiga baris bintang (wajah/komunikasi/kedisiplinan)
//   __blacklist_info  badge status blacklist + alasannya
//   __usia            umur dihitung dari tanggal lahir (tidak pernah basi)

export const VIEW_COLUMNS = {
  master: [
    { key: "nama", variant: "primary", sort: "nama" },
    { key: "nik", label: "NIK", variant: "mono" },
    { key: "email", variant: "mutedXs" },
    { key: "no_hp", variant: "mono" },
    { key: "alamat", variant: "truncate" },
    { key: "__usia", label: "Usia", sort: "usia" },
    { key: "apply", sort: "apply" },
    { key: "__rating_avg", label: "Nilai", sort: "nilai" },
    { key: "status_interview" },
    { key: "status_tanda_tangan", label: "TTD Kesepakatan" },
    { key: "status_training" },
    { key: "status_kontrak", label: "TTD Kontrak" },
    { key: "status_blacklist", label: "Blacklist" },
    { key: "pic" },
    { key: "created_at", label: "Tgl Input", variant: "date", sort: "created_at" },
  ],
  interview: [
    { key: "nama", variant: "primary", sort: "nama" },
    { key: "apply", sort: "apply" },
    { key: "tanggal_interview", label: "Tanggal", variant: "mono",
      sort: "tanggal_interview" },
    { key: "jam_interview", label: "Jam", variant: "mono" },
    { key: "metode_interview", label: "Metode", variant: "text" },
    { key: "status_interview", label: "Status" },
    { key: "__rating_stack", label: "Nilai", sort: "nilai" },
    { key: "pic" },
  ],
  training: [
    { key: "nama", variant: "primary", sort: "nama" },
    { key: "posisi_fix", label: "Posisi", fallback: "posisi_penempatan" },
    { key: "penempatan_fix", label: "Penempatan", fallback: "rencana_penempatan",
      sort: "penempatan_fix" },
    { key: "tanggal_mulai_training", label: "Mulai Training", variant: "mono",
      sort: "tanggal_mulai_training" },
    { key: "status_training", label: "Status" },
    { key: "pic" },
  ],
  blacklist: [
    { key: "nama", variant: "primary" },
    { key: "nik", label: "NIK", variant: "mono" },
    { key: "no_hp", variant: "mono" },
    { key: "apply" },
    { key: "__blacklist_info", label: "Alasan Blacklist" },
    { key: "pic" },
  ],
  kontrak: [
    { key: "nama", variant: "primary" },
    { key: "nik", label: "NIK", variant: "mono" },
    { key: "posisi_fix", label: "Posisi", fallback: "apply" },
    { key: "penempatan_fix", label: "Penempatan" },
    { key: "tanggal_ttd_kontrak", label: "TTD Kontrak", variant: "mono" },
    { key: "tanggal_habis_kontrak", label: "Habis Kontrak", variant: "mono",
      sort: "tanggal_habis_kontrak" },
    { key: "status_kontrak", label: "Status" },
    { key: "pic" },
  ],
  placement: [
    { key: "nama", variant: "primary", sort: "nama" },
    { key: "penempatan_fix", label: "Penempatan", sort: "penempatan_fix" },
    { key: "posisi_fix", label: "Posisi Fix" },
    { key: "status_training" },
    { key: "pic" },
  ],
};

export const columnsFor = (view) => VIEW_COLUMNS[view] || VIEW_COLUMNS.master;
