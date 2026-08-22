// Warna badge status di tabel.
// Tambah aturan baru: tambah entri per key field, urutan dievaluasi dari atas.
// `when` menerima nilai status dalam huruf kecil.

export const STATUS_TONES = {
  status_interview: [
    { when: (v) => v.includes("lulus") && !v.includes("tidak"), tone: "emerald" },
    { when: (v) => v.includes("tidak lulus"), tone: "rose" },
    { when: (v) => ["terjadwal", "sudah dipanggil", "selesai"].some((s) => v.includes(s)), tone: "amber" },
  ],
  status_training: [
    { when: (v) => v.includes("lulus training") && !v.includes("tidak"), tone: "emerald" },
    { when: (v) => v.includes("tidak lulus"), tone: "rose" },
    { when: (v) => v.includes("training"), tone: "indigo" },
    { when: (v) => v.includes("selesai"), tone: "sky" },
  ],
  status_tanda_tangan: [
    { when: (v) => v === "sudah", tone: "emerald" },
    { when: (v) => v.startsWith("mengundurkan"), tone: "rose" },
  ],
  status_blacklist: [
    { when: (v) => v.startsWith("ya"), tone: "rose" },
  ],
};

export function toneForStatus(fieldKey, value) {
  const v = (value || "").toLowerCase();
  for (const rule of STATUS_TONES[fieldKey] || []) {
    if (rule.when(v)) return rule.tone;
  }
  return "neutral";
}
