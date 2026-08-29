// Portal lowongan (publik) — daftar loker yang sedang dibuka.

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, describeApiError, posterUrl } from "@/lib/api";
import { Briefcase, MapPin, Users2, CalendarClock, ArrowRight } from "lucide-react";
import PortalShell from "@/components/PortalShell";
import { formatDate } from "@/lib/dates";
import { T } from "@/config/theme";

export default function PortalLowongan() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [pesan, setPesan] = useState("");

  useEffect(() => {
    api.get("/publik/lowongan")
      .then(({ data }) => { setItems(data || []); setStatus("ready"); })
      .catch((e) => { setPesan(describeApiError(e, "Gagal memuat lowongan")); setStatus("error"); });
  }, []);

  return (
    <PortalShell>
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 mb-3">
          <Briefcase className="w-3 h-3 text-indigo-700 dark:text-indigo-300" />
          <span className="text-indigo-700 dark:text-indigo-200 text-[10px] tracking-[0.2em] uppercase">Lowongan Terbuka</span>
        </div>
        <h1 className={T.title}>Bergabung bersama kami</h1>
        <p className={T.subtitle}>
          Pilih posisi yang sesuai, lalu kirim lamaran Anda langsung dari halaman ini.
        </p>
      </div>

      {status === "loading" && <div className="text-slate-500 dark:text-slate-400 py-12 text-center">Memuat lowongan...</div>}
      {status === "error" && (
        <div className={`${T.panelSubtle} p-8 text-center text-slate-400 dark:text-slate-600 dark:text-slate-300`}>{pesan}</div>
      )}
      {status === "ready" && items.length === 0 && (
        <div className={`${T.panelSubtle} p-12 text-center`}>
          <p className="text-slate-400 dark:text-slate-600 dark:text-slate-300">Belum ada lowongan yang dibuka saat ini.</p>
          <p className={`${T.hint} mt-1`}>Silakan cek kembali beberapa waktu lagi.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((job) => (
          <Link key={job.slug} to={`/lowongan/${job.slug}`}
            data-testid={`lowongan-${job.slug}`}
            className={`${T.panel} block hover:border-indigo-500/40 transition-colors overflow-hidden`}>
            {job.poster && (
              <img src={posterUrl(job.poster)} alt={`Poster ${job.judul}`}
                className="w-full max-h-72 object-cover border-b border-slate-200 dark:border-slate-800" />
            )}
            <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-50">{job.judul}</h2>
              <ArrowRight className="w-4 h-4 text-slate-500 shrink-0 mt-1" />
            </div>
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500 dark:text-slate-400">
              {job.unit_usaha && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {job.unit_usaha}
                </span>
              )}
              {job.tipe_kerja && (
                <span className="inline-flex items-center gap-1">
                  <Briefcase className="w-3 h-3" /> {job.tipe_kerja}
                </span>
              )}
              {job.kuota ? (
                <span className="inline-flex items-center gap-1">
                  <Users2 className="w-3 h-3" /> {job.kuota} orang
                </span>
              ) : null}
              {job.batas_lamaran && (
                <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                  <CalendarClock className="w-3 h-3" /> s/d {formatDate(job.batas_lamaran)}
                </span>
              )}
            </div>
            {job.deskripsi && (
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-3 line-clamp-3">{job.deskripsi}</p>
            )}
            </div>
          </Link>
        ))}
      </div>
    </PortalShell>
  );
}
