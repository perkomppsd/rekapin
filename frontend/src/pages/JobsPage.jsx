// Kelola lowongan (admin): buat, ubah, aktifkan/tutup.
// Lowongan berstatus "Aktif" otomatis tampil di portal publik /lowongan.

import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useMeta } from "@/context/MetaContext";
import { Navigate, Link } from "react-router-dom";
import { api, describeApiError, posterUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, ExternalLink, X, Image as ImageIcon } from "lucide-react";
import AdminPageShell from "@/components/AdminPageShell";
import { formatDate } from "@/lib/dates";
import { FORM, T, tone } from "@/config/theme";

const KOSONG = {
  judul: "", jobdesk: "", unit_usaha: "", tipe_kerja: "Full Time",
  deskripsi: "", persyaratan: "", kuota: "", batas_lamaran: "", status: "Draft",
};

const TONE_STATUS = { Aktif: "emerald", Draft: "neutral", Tutup: "rose" };

export default function JobsPage() {
  const { user } = useAuth();
  const meta = useMeta();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(KOSONG);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/lowongan");
      setItems(data || []);
    } catch (e) {
      toast.error(describeApiError(e, "Gagal memuat lowongan"));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (user === null) return <div className="min-h-screen bg-white dark:bg-slate-950" />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/dashboard" replace />;

  const opsi = (key) => meta.fieldByKey?.[key]?.options || [];
  const jobdeskOptions = opsi("posisi_fix");
  const unitOptions = opsi("penempatan_fix");
  const tipeOptions = meta.statusesOf ? meta.statusesOf("tipe_kerja") : [];
  const statusOptions = meta.statusesOf ? meta.statusesOf("status_lowongan") : [];

  const simpan = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, kuota: form.kuota === "" ? null : Number(form.kuota) };
    try {
      if (editId) {
        await api.put(`/lowongan/${editId}`, payload);
        toast.success("Lowongan diperbarui");
      } else {
        await api.post("/lowongan", payload);
        toast.success("Lowongan dibuat");
      }
      setForm(KOSONG); setEditId(null);
      await load();
    } catch (err) {
      toast.error(describeApiError(err, "Gagal menyimpan lowongan"));
    } finally { setSaving(false); }
  };

  const ubahStatus = async (job, status) => {
    try {
      await api.put(`/lowongan/${job.id}`, { status });
      toast.success(`"${job.judul}" -> ${status}`);
      await load();
    } catch (e) {
      toast.error(describeApiError(e, "Gagal mengubah status"));
    }
  };

  const hapus = async (job) => {
    if (!window.confirm(`Hapus lowongan "${job.judul}"?`)) return;
    try {
      await api.delete(`/lowongan/${job.id}`);
      toast.success("Lowongan dihapus");
      await load();
    } catch (e) {
      toast.error(describeApiError(e, "Gagal menghapus"));
    }
  };

  const unggahPoster = async (job, file) => {
    if (!file) return;
    const data = new FormData();
    data.append("file", file);
    try {
      await api.post(`/lowongan/${job.id}/poster`, data);
      toast.success("Poster diperbarui");
      await load();
    } catch (e) {
      toast.error(describeApiError(e, "Gagal mengunggah poster"));
    }
  };

  const hapusPoster = async (job) => {
    if (!window.confirm("Hapus poster lowongan ini?")) return;
    try {
      await api.delete(`/lowongan/${job.id}/poster`);
      toast.success("Poster dihapus");
      await load();
    } catch (e) {
      toast.error(describeApiError(e, "Gagal menghapus poster"));
    }
  };

  const mulaiEdit = (job) => {
    setEditId(job.id);
    setForm({ ...KOSONG, ...job, kuota: job.kuota ?? "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <AdminPageShell
      title="Kelola Lowongan"
      badge="Portal Karier"
      badgeIcon="Briefcase"
      description="Lowongan berstatus Aktif otomatis tampil di portal publik dan bisa dilamar tanpa login."
    >
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/lowongan" target="_blank" rel="noreferrer">
          <Button variant="outline" className={T.btnOutline}>
            <ExternalLink className="w-4 h-4 mr-2" /> Lihat portal publik
          </Button>
        </Link>
        <Link to="/lamaran">
          <Button variant="outline" className={`rounded-full pill-btn ${tone("indigo", "button")}`}>
            Lamaran Masuk
          </Button>
        </Link>
      </div>

      <form onSubmit={simpan} className={`${T.panel} p-6 space-y-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-medium">
            <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            {editId ? "Ubah Lowongan" : "Buat Lowongan Baru"}
          </div>
          {editId && (
            <Button type="button" variant="ghost" className={T.btnGhostPlain}
              onClick={() => { setEditId(null); setForm(KOSONG); }}>
              <X className="w-4 h-4 mr-1" /> Batal
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Label className={T.label}>Judul Lowongan *</Label>
            <Input required value={form.judul} data-testid="input-lowongan-judul"
              placeholder="cth. Kasir Toserba Payaman"
              onChange={(e) => setForm({ ...form, judul: e.target.value })} className={FORM.input} />
          </div>
          <div>
            <Label className={T.label}>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger className={FORM.select} data-testid="select-lowongan-status"><SelectValue /></SelectTrigger>
              <SelectContent className={T.selectContent}>
                {statusOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className={T.label}>Jobdesk</Label>
            <Select value={form.jobdesk || undefined} onValueChange={(v) => setForm({ ...form, jobdesk: v })}>
              <SelectTrigger className={FORM.select}><SelectValue placeholder="Pilih..." /></SelectTrigger>
              <SelectContent className={T.selectContent}>
                {jobdeskOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className={T.label}>Unit Usaha</Label>
            <Select value={form.unit_usaha || undefined} onValueChange={(v) => setForm({ ...form, unit_usaha: v })}>
              <SelectTrigger className={FORM.select}><SelectValue placeholder="Pilih..." /></SelectTrigger>
              <SelectContent className={T.selectContent}>
                {unitOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className={T.label}>Tipe Kerja</Label>
            <Select value={form.tipe_kerja} onValueChange={(v) => setForm({ ...form, tipe_kerja: v })}>
              <SelectTrigger className={FORM.select}><SelectValue /></SelectTrigger>
              <SelectContent className={T.selectContent}>
                {tipeOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className={T.label}>Kuota (orang)</Label>
            <Input type="number" min="1" value={form.kuota}
              onChange={(e) => setForm({ ...form, kuota: e.target.value })} className={FORM.input} />
          </div>
          <div>
            <Label className={T.label}>Batas Lamaran</Label>
            <Input type="date" value={form.batas_lamaran || ""}
              onChange={(e) => setForm({ ...form, batas_lamaran: e.target.value })} className={FORM.date} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className={T.label}>Deskripsi Pekerjaan</Label>
            <Textarea rows={4} value={form.deskripsi}
              onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} className={FORM.input} />
          </div>
          <div>
            <Label className={T.label}>Persyaratan</Label>
            <Textarea rows={4} value={form.persyaratan}
              onChange={(e) => setForm({ ...form, persyaratan: e.target.value })} className={FORM.input} />
          </div>
        </div>

        <Button type="submit" disabled={saving} className={T.btnPrimary} data-testid="btn-simpan-lowongan">
          <Plus className="w-4 h-4 mr-2" />
          {saving ? "Menyimpan..." : editId ? "Simpan Perubahan" : "Buat Lowongan"}
        </Button>
      </form>

      <div className={`${T.panelSubtle} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">Daftar Lowongan</div>
        {loading ? (
          <div className="text-slate-500 dark:text-slate-400 text-sm text-center py-8">Memuat...</div>
        ) : items.length === 0 ? (
          <div className="text-slate-500 text-sm text-center py-12">Belum ada lowongan.</div>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {items.map((job) => (
              <li key={job.id} className="px-4 py-3 flex items-start justify-between gap-3"
                data-testid={`row-lowongan-${job.id}`}>
                {/* Poster: gambar flyer loker yang tampil di portal publik */}
                <div className="shrink-0">
                  <label className="block cursor-pointer group"
                    title={job.poster ? "Klik untuk ganti poster" : "Klik untuk unggah poster"}>
                    <input type="file" className="hidden" accept=".jpg,.jpeg,.png"
                      data-testid={`input-poster-${job.id}`}
                      onChange={(e) => unggahPoster(job, e.target.files?.[0])} />
                    {job.poster ? (
                      <img src={posterUrl(job.poster)} alt={`Poster ${job.judul}`}
                        className="w-16 h-20 object-cover rounded-lg border border-slate-200 dark:border-slate-800 group-hover:border-indigo-500/50" />
                    ) : (
                      <div className="w-16 h-20 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center gap-1 text-slate-500 group-hover:border-indigo-500/50 group-hover:text-slate-400">
                        <ImageIcon className="w-4 h-4" />
                        <span className="text-[9px] text-center leading-tight">Poster</span>
                      </div>
                    )}
                  </label>
                  {job.poster && (
                    <button type="button" onClick={() => hapusPoster(job)}
                      className="text-[10px] text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 mt-1 w-16 text-center">
                      hapus
                    </button>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-900 dark:text-slate-100 font-medium">{job.judul}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${tone(TONE_STATUS[job.status] || "neutral", "pill")}`}>
                      {job.status}
                    </span>
                  </div>
                  <div className={`${T.hint} mt-1`}>
                    {[job.jobdesk, job.unit_usaha, job.tipe_kerja].filter(Boolean).join(" · ")}
                    {job.kuota ? ` · kuota ${job.kuota}` : ""}
                    {job.batas_lamaran ? ` · s/d ${formatDate(job.batas_lamaran)}` : ""}
                  </div>
                  <div className={`${T.hint} mt-0.5`}>
                    {job.jumlah_lamaran ? `${job.jumlah_lamaran} lamaran masuk` : "belum ada lamaran"}
                    {" · /lowongan/"}{job.slug}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {job.status !== "Aktif" && (
                    <Button size="sm" variant="outline" onClick={() => ubahStatus(job, "Aktif")}
                      className={`rounded-full ${tone("emerald", "button")}`}>Aktifkan</Button>
                  )}
                  {job.status === "Aktif" && (
                    <Button size="sm" variant="outline" onClick={() => ubahStatus(job, "Tutup")}
                      className={`rounded-full ${tone("rose", "button")}`}>Tutup</Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => mulaiEdit(job)}
                    className="h-8 w-8 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => hapus(job)}
                    className="h-8 w-8 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-500/10">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminPageShell>
  );
}
