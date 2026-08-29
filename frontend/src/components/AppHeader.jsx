// Header utama dashboard: brand, menu (config/navigation.js), info user, logout.

import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { BRAND, NAV_LINKS } from "@/config/navigation";
import { iconFor } from "@/config/icons";
import ThemeToggle from "@/components/ThemeToggle";
import { T } from "@/config/theme";

export default function AppHeader() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const links = NAV_LINKS.filter((l) => !l.adminOnly || isAdmin);

  return (
    <header className={T.nav}>
      <div className={`${T.container} h-16 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-display font-bold text-slate-900 dark:text-slate-50 leading-tight">{BRAND.name}</div>
            <div className="text-slate-500 text-[10px] tracking-[0.2em] uppercase">{BRAND.tagline}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {links.map((link) => {
            const Icon = iconFor(link.icon);
            return (
              <Link key={link.to} to={link.to} data-testid={link.testid}>
                <Button variant="ghost" className={T.btnGhost}>
                  <Icon className="w-4 h-4 mr-2" /> {link.label}
                </Button>
              </Link>
            );
          })}
          <div className="hidden sm:block text-right">
            <div className="text-slate-800 dark:text-slate-200 text-sm font-medium" data-testid="user-name">{user?.name}</div>
            <div className="text-slate-500 text-xs" data-testid="user-email">
              {user?.email} · {user?.role}
            </div>
          </div>
          <ThemeToggle />
          <Button variant="ghost" onClick={logout} data-testid="logout-button" className={T.btnGhost}>
            <LogOut className="w-4 h-4 mr-2" /> Keluar
          </Button>
        </div>
      </div>
    </header>
  );
}
