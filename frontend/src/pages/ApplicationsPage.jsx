// Kotak "Lamaran Masuk" — memeriksa lamaran dari portal sebelum jadi kandidat.

import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { api, API, describeApiError, tokenStore } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Check, X, Download, AlertTriangle, Inbox, ExternalLink, Trash2,
} from "lucide-react";
import AdminPageShell from "@/components/AdminPageShell";
import { ageFrom, formatDate } from "@/lib/dates";
import { FORM, T, tone } from "@/config/theme";

const TONE_STATUS = { Baru: "amber", Diproses: "indigo", Diterima: "emerald", Ditolak: "rose" };
const FILTER = ["Baru", "Diproses", "Diterima", "Ditolak"];

// Berkas diunduh lewat endpoint ber-otentikasi, jadi harus pakai fetch + token
// (tidak bisa <a href> biasa karena butuh header Authorization).
async function unduhBerkas(fileId, namaAsli) {
  try {
    const res = await fetch(`${API}/berkas/${fileId}`, {
      headers: { Authorization: `Bearer ${tokenStore.get()}` },
    });
    if (!res.ok) throw new Error("Berkas tidak bisa diunduh");
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url; a.download = namaAsli || "berkas";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    toast.error(e.message || "Gagal mengunduh berkas");
  }
}

function Baris({ label, nilai }) {
  if (!nilai) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-slate-500 w-40 shrink-0">{label}</span>
      <span className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">{nilai}</span>
    </div>
  );
}

export default function ApplicationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [ringkasan, setRingkasan] = useState({});
  const [filter, setFilter] = useState("Baru");
  const [loading, setLoading] = useState(true);
  const [buka, setBuka] = useState(null);
  const [catatan, setCatatan] = useState("");
  const [proses, setProses] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, sum] = await Promise.all([
        api.get("/lamaran", { params: { status: filter, per_page: 50 } }),
        api.get("/lamaran/ringkasan"),
      ]);
      setItems(list.data.items || []);
      setRingkasan(sum.data || {});
    } catch (e) {
      toast.error(describeApiError(e, "Gagal memuat lamaran"));
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  if (user === null) return <div className="min-h-screen bg-white dark:bg-slate-950" />;
  if (!user) return <Navigate to="/login" replace />;

  const terima = async (lam) => {
    setProses(true);
    try {
      const { data } = await api.post(`/lamaran/${lam.id}/terima`);
      toast.success(`${data.nama} masuk ke Master Data`);
      setBuka(null);
      await load();
    } catch (e) {
      toast.error(describeApiError(e, "Gagal menerima lamaran"), { duration: 10000 });
    } finally { setProses(false); }
  };

  const ubahStatus = async (lam, status) => {
    setProses(true);
    try {
      await api.post(`/lamaran/${lam.id}/status`, { status, catatan });
      toast.success(`Lamaran ${lam.nomor} -> ${status}`);
      setBuka(null); setCatatan("");
      await load();
    } catch (e) {
      toast.error(describeApiError(e, "Gagal mengubah status"));
    } finally { setProses(false); }
  };

  const hapus = async (lam) => {
    if (!window.confirm(`Hapus lamaran ${lam.nomor} beserta semua berkasnya?`)) return;
    try {
      await api.delete(`/lamaran/${lam.id}`);
      toast.success("Lamaran & berkasnya dihapus");
      setBuka(null);
      await load();
    } catch (e) {
      toast.error(describeApiError(e, "Gagal menghapus"));
    }
  };

  return (
    <AdminPageShell
      title="Lamaran Masuk"
      badge="Portal Karier"
      badgeIcon="Inbox"
      description="Lamaran dari portal publik. Periksa berkasnya, lalu Terima untuk memindahkan ke Master Data."
    >
      <div className="flex items-center gap-2 flex-wrap">
        {FILTER.map((s) => (
          <Button key={s} size="sm" variant="outline" onClick={() => { setFilter(s); setBuka(null); }}
            data-testid={`filter-lamaran-${s}`}
            className={`rounded-full ${filter === s ? tone(TONE_STATUS[s], "button") : T.btnOutline}`}>
            {s} <span className="ml-1.5 opacity-70">{ringkasan[s] ?? 0}</span>
          </Button>
        ))}
        <Link to="/kelola-lowongan" className="ml-auto">
          <Button variant="outline" size="sm" className={T.btnOutline}>
            <ExternalLink className="w-4 h-4 mr-2" /> Kelola Lowongan
          </Button>
        </Link>
      </div>

      <div className={`${T.panelSubtle} overflow-hidden`}>
        {loading ? (
          <div className="text-slate-500 dark:text-slate-400 text-sm text-center py-10">Memuat...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-14">
            <Inbox className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-slate-500 dark:text-slate-400">Tidak ada lamaran berstatus {filter}.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {items.map((lam) => {
              const terbuka = buka === lam.id;
              const umur = ageFrom(lam.tanggal_lahir);
              return (
                <li key={lam.id} data-testid={`row-lamaran-${lam.id}`}>
                  <button type="button"
                    onClick={() => { setBuka(terbuka ? null : lam.id); setCatatan(lam.catatan_admin || ""); }}
                    className="w-full text-left px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-slate-900 dark:text-slate-100 font-medium">{lam.nama}</span>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] border ${tone(TONE_STATUS[lam.status] || "neutral", "pill")}`}>
                            {lam.status}
                          </span>
                          {lam.nik_sudah_terdaftar && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                              title="NIK ini sudah ada di data kandidat — periksa dulu sebelum menerima">
                              <AlertTriangle className="w-3 h-3" /> NIK sudah terdaftar
                            </span>
                          )}
                        </div>
                        <div className={`${T.hint} mt-1`}>
                          {lam.nomor} · melamar {lam.job_judul} · {formatDate(lam.created_at)}
                        </div>
                      </div>
                      <span className="text-slate-500 text-xs shrink-0">{terbuka ? "tutup" : "lihat"}</span>
                    </div>
                  </button>

                  {terbuka && (
                    <div className="px-4 pb-4 space-y-4 border-t border-slate-200 dark:border-slate-800/70 pt-4">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <div className={T.sectionLabel}>Data Pelamar</div>
                          <Baris label="NIK" nilai={lam.nik} />
                          <Baris label="Tanggal Lahir" nilai={lam.tanggal_lahir && `${lam.tanggal_lahir} (${umur} tahun)`} />
                          <Baris label="No HP" nilai={lam.no_hp} />
                          <Baris label="Email" nilai={lam.email} />
                          <Baris label="Alamat KTP" nilai={lam.alamat} />
                          <Baris label="Domisili" nilai={lam.domisili} />
                          <Baris label="Status Pernikahan" nilai={lam.status_pernikahan} />
                          <Baris label="Pendidikan" nilai={lam.pendidikan_terakhir} />
                          <Baris label="Pengalaman Kerja" nilai={lam.pengalaman_kerja} />
                        </div>
                        <div>
                          <div className={`${T.sectionLabel} mb-2`}>Berkas</div>
                          <div className="grid grid-cols-1 gap-2">
                            {Object.entries(lam.berkas || {}).map(([key, b]) => (
                              <button key={key} type="button"
                                onClick={() => unduhBerkas(b.id, b.nama_asli)}
                                data-testid={`unduh-${key}-${lam.id}`}
                                className={`${T.panel} px-3 py-2 flex items-center justify-between gap-2 text-left hover:border-indigo-500/40`}>
                                <div className="min-w-0">
                                  <div className="text-slate-800 dark:text-slate-200 text-sm">{b.kategori || key}</div>
                                  <div className={`${T.hint} truncate`}>
                                    {b.nama_asli} · {(b.ukuran / 1024).toFixed(0)} KB
                                  </div>
                                </div>
                                <Download className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className={`${T.sectionLabel} mb-1.5`}>Catatan Internal</div>
                        <Textarea rows={2} value={catatan} className={FORM.input}
                          placeholder="Alasan ditolak / catatan untuk rekan tim"
                          onChange={(e) => setCatatan(e.target.value)} />
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {lam.status !== "Diterima" && (
                          <Button size="sm" disabled={proses} onClick={() => terima(lam)}
                            data-testid={`btn-terima-${lam.id}`}
                            className={`rounded-full ${tone("emerald", "button")}`}>
                            <Check className="w-4 h-4 mr-1" /> Terima jadi Kandidat
                          </Button>
                        )}
                        {lam.status === "Baru" && (
                          <Button size="sm" variant="outline" disabled={proses}
                            onClick={() => ubahStatus(lam, "Diproses")} className={T.btnOutline}>
                            Tandai Diproses
                          </Button>
                        )}
                        {lam.status !== "Ditolak" && lam.status !== "Diterima" && (
                          <Button size="sm" variant="outline" disabled={proses}
                            onClick={() => ubahStatus(lam, "Ditolak")}
                            className={`rounded-full ${tone("rose", "button")}`}>
                            <X className="w-4 h-4 mr-1" /> Tolak
                          </Button>
                        )}
                        {lam.candidate_id && (
                          <Link to="/dashboard" className={`${T.hint} underline`}>
                            sudah jadi kandidat di Master Data
                          </Link>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => hapus(lam)}
                          className="ml-auto text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-500/10">
                          <Trash2 className="w-4 h-4 mr-1" /> Hapus
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AdminPageShell>
  );
}
