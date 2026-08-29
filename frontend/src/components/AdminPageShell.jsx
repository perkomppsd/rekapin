// Kerangka halaman admin (User, Setting): header "kembali", judul, badge.

import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { iconFor } from "@/config/icons";
import ThemeToggle from "@/components/ThemeToggle";
import { T } from "@/config/theme";

export default function AdminPageShell({ title, description, badge, badgeIcon, children }) {
  const BadgeIcon = badgeIcon ? iconFor(badgeIcon) : null;
  return (
    <div className={T.page}>
      <header className={T.nav}>
        <div className={`${T.containerNarrow} h-16 flex items-center justify-between`}>
          <Link to="/dashboard" className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-50">
            <ArrowLeft className="w-4 h-4" /> <span>Kembali ke Dashboard</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-slate-500 text-[10px] tracking-[0.2em] uppercase">{title}</div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className={`${T.containerNarrow} py-8 space-y-8`}>
        <div>
          {badge ? (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 mb-3">
              {BadgeIcon ? <BadgeIcon className="w-3 h-3 text-indigo-700 dark:text-indigo-300" /> : null}
              <span className="text-indigo-700 dark:text-indigo-200 text-[10px] tracking-[0.2em] uppercase">{badge}</span>
            </div>
          ) : null}
          <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-slate-50">{title}</h1>
          {description ? <p className={T.subtitle}>{description}</p> : null}
        </div>
        {children}
      </main>
    </div>
  );
}
