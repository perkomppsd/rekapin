// Token kelas Tailwind yang dipakai berulang di banyak halaman.
// UBAH TAMPILAN DARI SINI — jangan menulis ulang string kelas di komponen.

export const T = {
  // Layout
  page: "min-h-screen bg-slate-950 noise-bg",
  nav: "glass-nav sticky top-0 z-30",
  container: "max-w-[1600px] mx-auto px-4 md:px-8",
  containerNarrow: "max-w-[1200px] mx-auto px-4 md:px-8",

  // Panel & kartu
  panel: "bg-slate-900/60 border border-slate-800 rounded-xl",
  panelSubtle: "border border-slate-800 rounded-xl bg-slate-900/40",
  dialog: "bg-slate-900 border-slate-800 text-slate-50",
  toast: "bg-slate-900 border border-slate-800 text-slate-50",

  // Teks
  label: "text-slate-400 text-[10px] tracking-[0.2em] uppercase",
  sectionLabel: "text-slate-500 text-[10px] tracking-[0.25em] uppercase",
  th: "text-slate-400 text-[10px] tracking-[0.2em] uppercase",
  title: "font-display text-3xl md:text-4xl font-bold text-slate-50",
  subtitle: "text-slate-400 text-sm mt-1",
  hint: "text-slate-500 text-xs",

  // Form
  input: "bg-slate-950 border-slate-800 text-slate-50 focus:border-indigo-500 focus-visible:ring-indigo-500/30",
  inputLight: "bg-slate-900 border-slate-800 text-slate-50 focus:border-indigo-500",
  selectContent: "bg-slate-900 border-slate-800 text-slate-50",
  darkDate: "[color-scheme:dark] cursor-pointer",

  // Tombol
  btnPrimary: "bg-indigo-600 hover:bg-indigo-500 text-white rounded-full pill-btn",
  btnOutline: "border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-slate-50 rounded-full pill-btn",
  btnGhost: "text-slate-300 hover:text-slate-50 hover:bg-slate-800 rounded-full",
  btnGhostPlain: "text-slate-300 hover:text-slate-50 hover:bg-slate-800",
  btnDanger: "bg-rose-600 hover:bg-rose-500 text-white",
  btnCancel: "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 hover:text-slate-50",
};

// Turunan yang sering dipakai bersamaan.
export const FORM = {
  input: T.input,
  select: `${T.input} h-10`,
  date: `${T.input} ${T.darkDate}`,
};

// Warna aksen. Dipakai kartu statistik (`card`), badge/pill (`pill`),
// dan tombol beraksen (`button`). Tambah warna baru = tambah satu entri.
export const TONES = {
  indigo: {
    card: "text-indigo-300 bg-indigo-500/10 border-indigo-500/20",
    pill: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
    button: "border-indigo-500/40 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20 hover:text-indigo-50",
  },
  amber: {
    card: "text-amber-300 bg-amber-500/10 border-amber-500/20",
    pill: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    button: "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 hover:text-amber-50",
  },
  emerald: {
    card: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    pill: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    button: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 hover:text-emerald-50",
  },
  rose: {
    card: "text-rose-300 bg-rose-500/10 border-rose-500/20",
    pill: "bg-rose-500/10 text-rose-300 border-rose-500/20",
    button: "border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 hover:text-rose-50",
  },
  sky: {
    card: "text-sky-300 bg-sky-500/10 border-sky-500/20",
    pill: "bg-sky-500/10 text-sky-300 border-sky-500/20",
    button: "border-sky-500/40 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20 hover:text-sky-50",
  },
  neutral: {
    card: "text-slate-300 bg-slate-800 border-slate-700",
    pill: "bg-slate-800 text-slate-300 border-slate-700",
    button: "border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-slate-50",
  },
};

export const tone = (name, part = "pill") =>
  (TONES[name] || TONES.neutral)[part] || TONES.neutral[part];
