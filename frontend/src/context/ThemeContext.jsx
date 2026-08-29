// Tema terang / gelap.
//
// Cara kerjanya: kelas `dark` dipasang di elemen <html>, lalu Tailwind memakai
// varian `dark:` (tailwind.config.js sudah darkMode: ["class"]).
// Pilihan disimpan di localStorage; default mengikuti setelan sistem.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const KEY = "rekapin_tema";
const ThemeContext = createContext(null);

const sistemGelap = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-color-scheme: dark)").matches;

function bacaPilihan() {
  try {
    const tersimpan = localStorage.getItem(KEY);
    if (tersimpan === "light" || tersimpan === "dark") return tersimpan;
  } catch {
    /* localStorage bisa diblokir browser — abaikan, pakai setelan sistem */
  }
  return "system";
}

function terapkan(tema) {
  const gelap = tema === "dark" || (tema === "system" && sistemGelap());
  document.documentElement.classList.toggle("dark", gelap);
  document.documentElement.style.colorScheme = gelap ? "dark" : "light";
  return gelap;
}

export function ThemeProvider({ children }) {
  const [tema, setTema] = useState(bacaPilihan);
  const [gelap, setGelap] = useState(() => tema === "dark" || (tema === "system" && sistemGelap()));

  useEffect(() => {
    setGelap(terapkan(tema));
    try {
      if (tema === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, tema);
    } catch {
      /* abaikan kalau localStorage tidak tersedia */
    }
  }, [tema]);

  // Kalau mengikuti sistem, ikut berubah saat setelan OS diubah.
  useEffect(() => {
    if (tema !== "system") return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setGelap(terapkan("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [tema]);

  const toggle = useCallback(() => setTema(gelap ? "light" : "dark"), [gelap]);

  const value = useMemo(() => ({ tema, gelap, setTema, toggle }), [tema, gelap, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext) || { tema: "dark", gelap: true, toggle: () => {} };
