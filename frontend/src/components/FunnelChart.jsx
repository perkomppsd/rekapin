import React from "react";

export default function FunnelChart({ stages = [] }) {
  const max = Math.max(...stages.map((s) => s.count), 1);
  const colors = ["indigo", "amber", "sky", "violet", "emerald"];
  const barTone = {
    indigo: "bg-indigo-500",
    amber: "bg-amber-500",
    sky: "bg-sky-500",
    violet: "bg-violet-500",
    emerald: "bg-emerald-500",
  };

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/40 p-5 h-full"
      data-testid="funnel-chart">
      <div className="mb-4">
        <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-50">Funnel Rekrutmen</h3>
        <p className="text-slate-500 dark:text-slate-400 text-xs">
          Alur kandidat dari lamaran sampai kontrak — lihat drop-off tiap tahap.
        </p>
      </div>
      <div className="space-y-2">
        {stages.map((s, i) => {
          const width = Math.max((s.count / max) * 100, 3);
          const color = colors[i % colors.length];
          return (
            <div key={s.key} data-testid={`funnel-stage-${s.key}`}>
              <div className="flex items-center justify-between text-sm mb-0.5 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 dark:text-slate-300 text-[10px] flex items-center justify-center shrink-0">{i + 1}</span>
                  <span className="text-slate-900 dark:text-slate-100 font-medium truncate">{s.label}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-slate-900 dark:text-slate-100 font-mono font-medium">{s.count}</span>
                  {i > 0 && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      konversi <span className="text-slate-800 dark:text-slate-200">{s.conversion}%</span>
                      {s.dropoff > 0 && <span className="text-rose-600 dark:text-rose-400"> · drop {s.dropoff}</span>}
                    </span>
                  )}
                </div>
              </div>
              <div className="h-5 bg-slate-100 dark:bg-slate-950/60 rounded overflow-hidden border border-slate-200 dark:border-slate-800">
                <div
                  className={`h-full ${barTone[color]} transition-[width] duration-500`}
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
