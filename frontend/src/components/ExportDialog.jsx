import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { FileSpreadsheet, FileText, CheckCircle2, Download, Filter } from "lucide-react";
import { T } from "../config/theme";

const PRESETS = [
  {
    id: "full",
    title: "Master Data Lengkap",
    desc: "Mengekspor seluruh kolom kandidat tanpa terkecuali.",
    icon: FileSpreadsheet,
    badge: "Lengkap",
  },
  {
    id: "summary",
    title: "Ringkasan Penempatan",
    desc: "Nama, HP, Penempatan Fix, Posisi Fix, Status, Mulai Training, Habis Kontrak, PIC.",
    icon: Filter,
    badge: "Ops & Cabang",
  },
  {
    id: "evaluation",
    title: "Evaluasi & Penilaian",
    desc: "Nama, Posisi, Pendidikan, Pengalaman, Penilaian Komunikasi/Kedisiplinan, Rata-rata.",
    icon: CheckCircle2,
    badge: "Kualitas HR",
  },
  {
    id: "legal",
    title: "Kontrak & Legalitas",
    desc: "NIK, Nama, Tanggal TTD Kesepakatan, Tanggal TTD Kontrak, Tanggal Habis Kontrak.",
    icon: FileText,
    badge: "Legal & Compliance",
  },
  {
    id: "blacklist",
    title: "Rekap Blacklist",
    desc: "NIK, Nama, No HP, Posisi, Status Blacklist, Alasan Blacklist, PIC.",
    icon: FileText,
    badge: "Track Record",
  },
];

export function ExportDialog({ open, onOpenChange, onExport, totalFiltered = 0, selectedCount = 0 }) {
  const [preset, setPreset] = useState("full");
  const [format, setFormat] = useState("xlsx");
  const [useSelectedOnly, setUseSelectedOnly] = useState(selectedCount > 0);

  const handleDownload = () => {
    onExport({
      preset,
      format,
      useSelectedOnly: selectedCount > 0 && useSelectedOnly,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${T.dialog} sm:max-w-[560px] p-6 rounded-2xl`}>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-50">
                Export Data Rekrutmen
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                Pilih preset kolom dan format file sesuai kebutuhan laporan Anda.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 my-2">
          {/* Preset Selection */}
          <div>
            <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tracking-[0.2em] uppercase block mb-2">
              Pilih Preset Kolom Laporan
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1">
              {PRESETS.map((p) => {
                const Icon = p.icon;
                const isSelected = preset === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setPreset(p.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                      isSelected
                        ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-900 dark:text-indigo-100 shadow-sm"
                        : "bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg mt-0.5 ${isSelected ? "bg-indigo-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{p.title}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                          {p.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{p.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scope selection if selectedCount > 0 */}
          {selectedCount > 0 && (
            <div>
              <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tracking-[0.2em] uppercase block mb-2">
                Cakupan Data Terunduh
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setUseSelectedOnly(true)}
                  className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                    useSelectedOnly
                      ? "bg-indigo-500/10 border-indigo-500 text-indigo-700 dark:text-indigo-300"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <span className="block font-bold">{selectedCount} Kandidat Terpilih</span>
                  <span className="text-[11px] text-slate-500">Hanya baris yang dicentang</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUseSelectedOnly(false)}
                  className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                    !useSelectedOnly
                      ? "bg-indigo-500/10 border-indigo-500 text-indigo-700 dark:text-indigo-300"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <span className="block font-bold">Semua Filter ({totalFiltered})</span>
                  <span className="text-[11px] text-slate-500">Seluruh data hasil pencarian</span>
                </button>
              </div>
            </div>
          )}

          {/* Format selection */}
          <div>
            <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tracking-[0.2em] uppercase block mb-2">
              Format File Output
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormat("xlsx")}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                  format === "xlsx"
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-300"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Excel (.xlsx) - Styled</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat("csv")}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                  format === "csv"
                    ? "bg-sky-500/10 border-sky-500 text-sky-700 dark:text-sky-300"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>CSV (.csv) - Data Mentah</span>
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className={T.btnOutline}>
            Batal
          </Button>
          <Button onClick={handleDownload} className={`${T.btnPrimary} flex items-center gap-2 px-5`}>
            <Download className="w-4 h-4" />
            <span>Unduh Laporan</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
