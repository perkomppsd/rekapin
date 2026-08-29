// Token kelas Tailwind yang dipakai berulang di banyak halaman.
// UBAH TAMPILAN DARI SINI — jangan menulis ulang string kelas di komponen.

export const T = {
  // Layout
  page: "min-h-screen bg-slate-50 dark:bg-slate-950 noise-bg",
  nav: "glass-nav sticky top-0 z-30",
  container: "max-w-[1600px] mx-auto px-4 md:px-8",
  containerNarrow: "max-w-[1200px] mx-auto px-4 md:px-8",

  // Panel & kartu
  panel: "bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl",
  panelSubtle: "border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/40",
  dialog: "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-50",
  toast: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-50",

  // Teks
  label: "text-slate-500 dark:text-slate-400 text-[10px] tracking-[0.2em] uppercase",
  sectionLabel: "text-slate-500 text-[10px] tracking-[0.25em] uppercase",
  th: "text-slate-500 dark:text-slate-400 text-[10px] tracking-[0.2em] uppercase",
  title: "font-display text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-50",
  subtitle: "text-slate-500 dark:text-slate-400 text-sm mt-1",
  hint: "text-slate-500 text-xs",

  // Form
  input: "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-50 focus:border-indigo-500 focus-visible:ring-indigo-500/30",
  inputLight: "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-50 focus:border-indigo-500",
  selectContent: "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-50",
  darkDate: "[color-scheme:dark] cursor-pointer",

  // Tombol
  btnPrimary: "bg-indigo-600 hover:bg-indigo-500 text-white rounded-full pill-btn",
  btnOutline: "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-50 rounded-full pill-btn",
  btnGhost: "text-slate-400 dark:text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full",
  btnGhostPlain: "text-slate-400 dark:text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-slate-800",
  btnDanger: "bg-rose-600 hover:bg-rose-500 text-white",
  btnCancel: "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-50",
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
    card: "text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 border-indigo-500/30 dark:border-indigo-500/20",
    pill: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 dark:border-indigo-500/20",
    button: "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-500/20 hover:text-indigo-900 dark:hover:text-indigo-50",
  },
  amber: {
    card: "text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30 dark:border-amber-500/20",
    pill: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 dark:border-amber-500/20",
    button: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200 hover:bg-amber-500/20 hover:text-amber-900 dark:hover:text-amber-50",
  },
  emerald: {
    card: "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30 dark:border-emerald-500/20",
    pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 dark:border-emerald-500/20",
    button: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-500/20 hover:text-emerald-900 dark:hover:text-emerald-50",
  },
  rose: {
    card: "text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/30 dark:border-rose-500/20",
    pill: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30 dark:border-rose-500/20",
    button: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-200 hover:bg-rose-500/20 hover:text-rose-900 dark:hover:text-rose-50",
  },
  sky: {
    card: "text-sky-700 dark:text-sky-300 bg-sky-500/10 border-sky-500/30 dark:border-sky-500/20",
    pill: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30 dark:border-sky-500/20",
    button: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-200 hover:bg-sky-500/20 hover:text-sky-900 dark:hover:text-sky-50",
  },
  teal: {
    card: "text-teal-700 dark:text-teal-300 bg-teal-500/10 border-teal-500/30 dark:border-teal-500/20",
    pill: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30 dark:border-teal-500/20",
    button: "border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-200 hover:bg-teal-500/20 hover:text-teal-900 dark:hover:text-teal-50",
  },
  violet: {
    card: "text-violet-700 dark:text-violet-300 bg-violet-500/10 border-violet-500/30 dark:border-violet-500/20",
    pill: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30 dark:border-violet-500/20",
    button: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-200 hover:bg-violet-500/20 hover:text-violet-900 dark:hover:text-violet-50",
  },
  neutral: {
    card: "text-slate-400 dark:text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700",
    pill: "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700",
    button: "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-50",
  },
};

export const tone = (name, part = "pill") =>
  (TONES[name] || TONES.neutral)[part] || TONES.neutral[part];
