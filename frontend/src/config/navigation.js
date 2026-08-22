// Menu di header dashboard. Tambah halaman baru = tambah satu entri
// (lalu daftarkan route-nya di src/App.js).

export const NAV_LINKS = [
  { to: "/users", label: "User", icon: "ShieldCheck", adminOnly: true, testid: "nav-users" },
  { to: "/settings", label: "Setting", icon: "Settings", adminOnly: true, testid: "nav-settings" },
];

export const BRAND = {
  name: "Rekapin",
  tagline: "HR Recruitment",
};
