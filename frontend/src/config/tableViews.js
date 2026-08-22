// Kolom tabel untuk setiap tab.
//
// Tambah / hapus / urutkan ulang kolom cukup di file ini.
//   key      : key field kandidat (atau kolom khusus di bawah)
//   label    : judul kolom (default: label field dari /api/meta)
//   fallback : key pengganti kalau nilai utama kosong
//   variant  : cara menampilkan sel (lihat daftar di bawah)
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

export const VIEW_COLUMNS = {
  master: [
    { key: "nama", variant: "primary" },
    { key: "nik", label: "NIK", variant: "mono" },
    { key: "email", variant: "mutedXs" },
    { key: "no_hp", variant: "mono" },
    { key: "alamat", variant: "truncate" },
    { key: "apply" },
    { key: "__rating_avg", label: "Nilai" },
    { key: "status_interview" },
    { key: "status_tanda_tangan", label: "Status TTD" },
    { key: "status_training" },
    { key: "status_blacklist", label: "Blacklist" },
    { key: "pic" },
    { key: "created_at", label: "Tgl Input", variant: "date" },
  ],
  interview: [
    { key: "nama", variant: "primary" },
    { key: "apply" },
    { key: "tanggal_interview", label: "Tanggal", variant: "mono" },
    { key: "jam_interview", label: "Jam", variant: "mono" },
    { key: "metode_interview", label: "Metode", variant: "text" },
    { key: "status_interview", label: "Status" },
    { key: "__rating_stack", label: "Nilai" },
    { key: "pic" },
  ],
  training: [
    { key: "nama", variant: "primary" },
    { key: "posisi_fix", label: "Posisi", fallback: "posisi_penempatan" },
    { key: "penempatan_fix", label: "Penempatan", fallback: "rencana_penempatan" },
    { key: "tanggal_mulai_training", label: "Mulai Training", variant: "mono" },
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
  placement: [
    { key: "nama", variant: "primary" },
    { key: "penempatan_fix", label: "Penempatan" },
    { key: "posisi_fix", label: "Posisi Fix" },
    { key: "status_training" },
    { key: "pic" },
  ],
};

export const columnsFor = (view) => VIEW_COLUMNS[view] || VIEW_COLUMNS.master;
