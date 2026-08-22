// Filter kandidat per tab di sisi browser.
//
// Daftar tab-nya sendiri datang dari backend (GET /api/meta -> app/schema.py).
// File ini hanya berisi FUNGSI filternya, karena fungsi tidak bisa dikirim
// lewat JSON. Kalau menambah tab baru di backend, tambahkan satu entri di sini
// dengan key yang sama. Tab tanpa entri = menampilkan semua kandidat.

const lower = (v) => (v || "").toString().toLowerCase();

export const TAB_PREDICATES = {
  interview: (r) => {
    const s = lower(r.status_interview);
    return s !== "" && s !== "belum dipanggil";
  },
  training: (r) => ["training", "lulus training"].includes(lower(r.status_training)),
  blacklist: (r) => lower(r.status_blacklist).startsWith("ya"),
  placement: (r) => Boolean((r.penempatan_fix || "").trim()),
};

export function filterByTab(rows, tabKey) {
  const predicate = TAB_PREDICATES[tabKey];
  return predicate ? rows.filter(predicate) : rows;
}
