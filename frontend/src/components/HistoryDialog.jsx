import React, { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { History, ArrowRight, Plus, Trash2, Upload, RefreshCw } from "lucide-react";

function formatTs(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function ActionBadge({ action }) {
  const cfg = {
    created: { cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20", icon: Plus, label: "Dibuat" },
    updated: { cls: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20", icon: RefreshCw, label: "Diubah" },
    deleted: { cls: "bg-rose-500/10 text-rose-300 border-rose-500/20", icon: Trash2, label: "Dihapus" },
    imported: { cls: "bg-sky-500/10 text-sky-300 border-sky-500/20", icon: Upload, label: "Diimport" },
  }[action] || { cls: "bg-slate-800 text-slate-300 border-slate-700", icon: History, label: action };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.cls}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

function ChangeRow({ change }) {
  if (!change) return null;
  if (change.field?.startsWith("_")) {
    return <div className="text-slate-300 text-sm">{change.label}: <span className="text-slate-100">{change.new || change.old || "—"}</span></div>;
  }
  return (
    <div className="text-sm flex flex-wrap items-center gap-2 text-slate-300">
      <span className="text-slate-500">{change.label}:</span>
      <span className="line-through text-slate-500 max-w-[280px] truncate">{String(change.old || "—")}</span>
      <ArrowRight className="w-3 h-3 text-slate-500" />
      <span className="text-slate-100 max-w-[320px] truncate">{String(change.new || "—")}</span>
    </div>
  );
}

export default function HistoryDialog({ open, onOpenChange, candidate }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !candidate?.id) return;
    setLoading(true);
    api.get(`/candidates/${candidate.id}/history`)
      .then((r) => setEntries(r.data))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [open, candidate?.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-slate-900 border-slate-800 text-slate-50 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" /> Timeline Kandidat
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Semua perubahan data untuk <span className="text-slate-200 font-medium">{candidate?.nama}</span>.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-slate-400 text-sm py-8 text-center">Memuat...</div>
        ) : entries.length === 0 ? (
          <div className="text-slate-400 text-sm py-8 text-center border border-dashed border-slate-800 rounded-lg">
            Belum ada riwayat perubahan.
          </div>
        ) : (
          <ol className="relative border-l border-slate-800 pl-6 space-y-6" data-testid="history-list">
            {entries.map((e) => (
              <li key={e.id} className="relative" data-testid={`history-entry-${e.id}`}>
                <span className="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-slate-900" />
                <div className="flex items-center gap-2 flex-wrap">
                  <ActionBadge action={e.action} />
                  <span className="text-slate-400 text-xs">{formatTs(e.changed_at)}</span>
                  <span className="text-slate-500 text-xs">· oleh {e.changed_by_name || e.changed_by || "system"}</span>
                </div>
                <div className="mt-2 space-y-1">
                  {(e.changes || []).map((c, i) => <ChangeRow key={i} change={c} />)}
                </div>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
