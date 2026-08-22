// Perhitungan tanggal yang dipakai di beberapa tempat.
// Umur SELALU dihitung dari tanggal lahir, tidak pernah disimpan — jadi tidak
// mungkin basi. Sumber kebenarannya: field `tanggal_lahir`.

export function ageFrom(birthdate, today = new Date()) {
  if (!birthdate) return null;
  const born = new Date(`${birthdate}T00:00:00`);
  if (Number.isNaN(born.getTime())) return null;
  let age = today.getFullYear() - born.getFullYear();
  const belumUlangTahun =
    today.getMonth() < born.getMonth() ||
    (today.getMonth() === born.getMonth() && today.getDate() < born.getDate());
  if (belumUlangTahun) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

// Umur untuk ditampilkan. `usia` hanya dipakai sebagai cadangan untuk data lama
// yang tersimpan sebelum kolom tanggal lahir ada.
export function displayAge(row) {
  const dari = ageFrom(row?.tanggal_lahir);
  if (dari !== null) return { value: dari, perkiraan: false };
  const lama = Number(row?.usia);
  if (Number.isFinite(lama) && lama > 0) return { value: lama, perkiraan: true };
  return null;
}

export function formatDate(iso, locale = "id-ID") {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(locale, {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch {
    return iso;
  }
}
