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
    <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-6" data-testid="funnel-chart">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-display text-lg font-semibold text-slate-50">Funnel Rekrutmen</h3>
          <p className="text-slate-400 text-sm">Alur kandidat dari lamaran sampai penempatan — lihat drop-off tiap tahap.</p>
        </div>
      </div>
      <div className="space-y-3">
        {stages.map((s, i) => {
          const width = Math.max((s.count / max) * 100, 3);
          const color = colors[i % colors.length];
          return (
            <div key={s.key} data-testid={`funnel-stage-${s.key}`}>
              <div className="flex items-center justify-between text-sm mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 text-xs flex items-center justify-center">{i + 1}</span>
                  <span className="text-slate-100 font-medium">{s.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-100 font-mono font-medium">{s.count}</span>
                  {i > 0 && (
                    <span className="text-xs text-slate-400">
                      konversi <span className="text-slate-200">{s.conversion}%</span>
                      {s.dropoff > 0 && <span className="text-rose-400"> · drop {s.dropoff}</span>}
                    </span>
                  )}
                </div>
              </div>
              <div className="h-8 bg-slate-950/60 rounded-md overflow-hidden border border-slate-800">
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
