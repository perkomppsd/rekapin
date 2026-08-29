// Import massal dengan cara paste dari Google Sheets / Excel.
// Urutan kolom mengikuti /api/meta -> IMPORT_POSITIONAL di backend/app/schema.py,
// jadi panduan kolom di UI selalu sama dengan yang dibaca server.

import React, { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ClipboardPaste, Rows, CheckCircle2 } from "lucide-react";
import { useMeta } from "@/context/MetaContext";
import { parsePaste } from "@/lib/paste";
import { T } from "@/config/theme";

const PREVIEW_LIMIT = 30;

export default function BulkImportDialog({ open, onOpenChange, onImport }) {
  const meta = useMeta();
  const [raw, setRaw] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const columns = useMemo(() => meta.import_columns || [], [meta.import_columns]);
  const columnKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const numberKeys = useMemo(
    () => meta.fields.filter((f) => f.type === "number").map((f) => f.key),
    [meta.fields],
  );

  const rows = useMemo(
    () => parsePaste(raw, columnKeys, numberKeys),
    [raw, columnKeys, numberKeys],
  );

  const placeholder = useMemo(() => {
    if (!columns.length) return "";
    return columns.map((c) => c.label).join("\t");
  }, [columns]);

  const handleImport = async () => {
    if (!rows.length) return;
    setSubmitting(true);
    const ok = await onImport(rows);
    setSubmitting(false);
    if (ok) {
      setRaw("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-4xl ${T.dialog} max-h-[90vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <ClipboardPaste className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Import Massal dari Google Sheets / Excel
          </DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400">
            Salin data kandidat dari Google Forms / Google Sheets / Excel — lalu paste di kotak di bawah.
            Urutan kolom harus mengikuti panduan berikut. Baris pertama sebagai header opsional (otomatis dideteksi).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Panduan urutan kolom */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-slate-100 dark:bg-slate-950/60">
            <div className={`${T.sectionLabel} mb-2`}>Urutan Kolom</div>
            <div className="flex flex-wrap gap-1.5">
              {columns.map((c, i) => (
                <span key={c.key}
                  className="text-xs px-2 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/30 text-indigo-700 dark:text-indigo-200">
                  {i + 1}. {c.label}
                </span>
              ))}
            </div>
            <p className={`${T.hint} mt-2`}>
              Tip: di Google Sheets, blok baris → Ctrl+C → paste di sini. Kolom akan otomatis terpisah (TSV).
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className={T.label}>Paste Data</Label>
            <Textarea
              data-testid="bulk-paste-input"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={8}
              placeholder={placeholder}
              className={`${T.input} font-mono text-xs`}
            />
          </div>

          {/* Preview */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 text-sm">
                <Rows className="w-4 h-4" /> Preview
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400" data-testid="bulk-preview-count">
                {rows.length} baris siap import
              </div>
            </div>
            <div className="max-h-64 overflow-auto">
              {rows.length === 0 ? (
                <div className="text-slate-500 text-sm text-center py-8">
                  Belum ada data. Paste dulu di kotak atas.
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-white dark:bg-slate-900/60">
                    <tr className="text-slate-500 dark:text-slate-400">
                      <th className="text-left px-3 py-2 font-medium">#</th>
                      {columns.map((c) => (
                        <th key={c.key}
                          className="text-left px-3 py-2 font-medium tracking-[0.15em] uppercase text-[10px]">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, PREVIEW_LIMIT).map((r, i) => (
                      <tr key={i} className="border-t border-slate-200 dark:border-slate-800/70 text-slate-800 dark:text-slate-200">
                        <td className="px-3 py-1.5 text-slate-500">{i + 1}</td>
                        {columns.map((c) => (
                          <td key={c.key} className="px-3 py-1.5 whitespace-nowrap max-w-[180px] truncate">
                            {r[c.key] || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {rows.length > PREVIEW_LIMIT && (
                      <tr>
                        <td colSpan={columns.length + 1} className="text-slate-500 text-center py-2">
                          ...dan {rows.length - PREVIEW_LIMIT} baris lainnya
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}
            className={T.btnGhostPlain} data-testid="btn-cancel-bulk">Batal</Button>
          <Button onClick={handleImport} disabled={submitting || rows.length === 0}
            className={T.btnPrimary} data-testid="btn-confirm-bulk">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {submitting ? "Mengimport..." : `Import ${rows.length} Kandidat`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
