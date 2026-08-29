// Tombol ganti tema terang/gelap.

import React from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { T } from "@/config/theme";

export default function ThemeToggle({ className = "" }) {
  const { gelap, toggle } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      data-testid="theme-toggle"
      aria-label={gelap ? "Ganti ke tema terang" : "Ganti ke tema gelap"}
      title={gelap ? "Tema terang" : "Tema gelap"}
      className={`${T.btnGhost} h-9 w-9 ${className}`}
    >
      {gelap ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  );
}
