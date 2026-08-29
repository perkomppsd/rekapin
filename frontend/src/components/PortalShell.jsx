// Kerangka halaman portal lowongan (publik, tanpa login).

import React from "react";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { BRAND } from "@/config/navigation";
import { T } from "@/config/theme";

export default function PortalShell({ children }) {
  return (
    <div className={T.page}>
      <header className={T.nav}>
        <div className={`${T.containerNarrow} h-16 flex items-center justify-between`}>
          <Link to="/lowongan" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-display font-bold text-slate-50 leading-tight">{BRAND.name}</div>
              <div className="text-slate-500 text-[10px] tracking-[0.2em] uppercase">Karier</div>
            </div>
          </Link>
          <Link to="/login" className={`${T.hint} hover:text-slate-300`}>Masuk sebagai HR</Link>
        </div>
      </header>
      <main className={`${T.containerNarrow} py-10`}>{children}</main>
      <footer className={`${T.containerNarrow} pb-10 ${T.hint}`}>
        © {new Date().getFullYear()} {BRAND.name} — {BRAND.tagline}
      </footer>
    </div>
  );
}
