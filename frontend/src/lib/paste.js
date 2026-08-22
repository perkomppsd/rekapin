// Parser data yang di-paste dari Google Sheets / Excel (TSV) atau CSV.
// Urutan kolom TIDAK ditentukan di sini — dikirim pemanggil (dari /api/meta).

export function parseLine(line) {
  // Utamakan tab (paste dari Sheets/Excel). Kalau tidak ada, pakai koma.
  if (line.includes("\t")) return line.split("\t");
  const out = [];
  let cur = "";
  let inside = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inside = !inside; continue; }
    if (ch === "," && !inside) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

// Kata yang menandai baris pertama sebagai header (bukan data).
const HEADER_HINTS = ["nama", "name", "email", "no hp", "phone", "usia"];

export function parsePaste(text, columnKeys, numberKeys = []) {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim().length);
  if (!lines.length || !columnKeys.length) return [];

  const firstCells = parseLine(lines[0]).map((s) => s.trim().toLowerCase());
  const isHeader = firstCells.some((c) => HEADER_HINTS.includes(c));
  const dataLines = isHeader ? lines.slice(1) : lines;

  return dataLines
    .map((line) => {
      const cells = parseLine(line).map((c) => c.trim());
      const row = {};
      columnKeys.forEach((key, idx) => { row[key] = cells[idx] || ""; });
      numberKeys.forEach((key) => {
        const n = parseInt(row[key], 10);
        row[key] = Number.isFinite(n) ? n : null;
      });
      return row;
    })
    .filter((r) => (r.nama || "").trim());
}
