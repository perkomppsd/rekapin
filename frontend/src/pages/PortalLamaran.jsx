// Halaman detail lowongan + form lamaran (publik, tanpa login).
//
// Daftar berkas & pilihan dropdown diambil dari GET /publik/form-lamaran,
// jadi kalau backend menambah syarat berkas, form ini ikut menyesuaikan.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, API, describeApiError, posterUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Briefcase, CalendarClock, CheckCircle2, MapPin, Paperclip, Send, Users2,
} from "lucide-react";
import PortalShell from "@/components/PortalShell";
import { ageFrom, formatDate } from "@/lib/dates";
import { FORM, T } from "@/config/theme";

const KOSONG = {
  nama: "", nik: "", email: "", no_hp: "", tanggal_lahir: "", alamat: "",
  domisili: "", status_pernikahan: "", pendidikan_terakhir: "", pengalaman_kerja: "",
};

function Field({ label, wajib, hint, children }) {
  return (
    <div className="space-y-1.5">
      <Label className={T.label}>
        {label}{wajib ? <span className="text-rose-600 dark:text-rose-400 ml-1">*</span> : null}
      </Label>
      {children}
      {hint ? <p className={T.hint}>{hint}</p> : null}
    </div>
  );
}

export default function PortalLamaran() {
  const { slug } = useParams();
  const [job, setJob] = useState(null);
  const [info, setInfo] = useState(null);
  const [status, setStatus] = useState("loading");
  const [form, setForm] = useState(KOSONG);
  const [berkas, setBerkas] = useState({});
  const [kirim, setKirim] = useState(false);
  const [error, setError] = useState("");
  const [sukses, setSukses] = useState(null);
  const formRef = useRef(null);

  useEffect(() => {
    Promise.all([
      api.get(`/publik/lowongan/${slug}`),
      api.get("/publik/form-lamaran"),
    ])
      .then(([j, i]) => { setJob(j.data); setInfo(i.data); setStatus("ready"); })
      .catch((e) => { setError(describeApiError(e, "Lowongan tidak ditemukan")); setStatus("error"); });
  }, [slug]);

  const umur = useMemo(() => ageFrom(form.tanggal_lahir), [form.tanggal_lahir]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const kurang = (info?.berkas || [])
      .filter((b) => b.wajib && !berkas[b.key])
      .map((b) => b.label);
    if (kurang.length) {
      setError(`Berkas wajib belum dilampirkan: ${kurang.join(", ")}`);
      return;
    }
    setKirim(true);
    try {
      const data = new FormData();
      data.append("slug", slug);
      Object.entries(form).forEach(([k, v]) => data.append(k, v));
      Object.entries(berkas).forEach(([k, file]) => file && data.append(k, file));
      const res = await fetch(`${API}/publik/lamaran`, { method: "POST", body: data });
      const hasil = await res.json();
      if (!res.ok) throw new Error(hasil.detail || "Lamaran gagal dikirim");
      setSukses(hasil);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message || "Lamaran gagal dikirim");
    } finally {
      setKirim(false);
    }
  };

  if (status === "loading") {
    return <PortalShell><div className="text-slate-500 dark:text-slate-400 py-16 text-center">Memuat...</div></PortalShell>;
  }
  if (status === "error") {
    return (
      <PortalShell>
        <div className={`${T.panelSubtle} p-12 text-center`}>
          <p className="text-slate-800 dark:text-slate-200">{error}</p>
          <Link to="/lowongan" className="text-indigo-600 dark:text-indigo-400 text-sm mt-3 inline-block">
            ← Lihat lowongan lain
          </Link>
        </div>
      </PortalShell>
    );
  }

  if (sukses) {
    return (
      <PortalShell>
        <div className={`${T.panel} p-10 text-center`} data-testid="lamaran-sukses">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto mb-4" />
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-50">Lamaran Terkirim</h1>
          <p className="text-slate-600 dark:text-slate-300 mt-2">{sukses.pesan}</p>
          <div className="mt-5 inline-block px-4 py-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10">
            <div className={T.label}>Nomor Lamaran</div>
            <div className="font-mono text-lg text-indigo-700 dark:text-indigo-200 mt-1">{sukses.nomor}</div>
          </div>
          <div className="mt-6">
            <Link to="/lowongan" className="text-indigo-600 dark:text-indigo-400 text-sm">← Lihat lowongan lain</Link>
          </div>
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell>
      <Link to="/lowongan" className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm mb-5">
        <ArrowLeft className="w-4 h-4" /> Semua lowongan
      </Link>

      {job.poster && (
        <div className="mb-6">
          {/* Di detail poster ditampilkan UTUH (object-contain) supaya syarat
              & jadwal di dalamnya terbaca, bukan dipotong seperti di kartu. */}
          <a href={posterUrl(job.poster)} target="_blank" rel="noreferrer"
            className={`${T.panel} block overflow-hidden max-w-sm mx-auto hover:border-indigo-500/40 transition-colors`}
            title="Klik untuk membuka ukuran penuh">
            <div className="aspect-[4/5] w-full bg-slate-100 dark:bg-slate-950">
              <img src={posterUrl(job.poster)} alt={`Poster ${job.judul}`}
                className="w-full h-full object-contain" />
            </div>
          </a>
          <p className={`${T.hint} text-center mt-2`}>Klik poster untuk melihat ukuran penuh</p>
        </div>
      )}

      <div className={`${T.panel} p-6 mb-6`}>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-50">{job.judul}</h1>
        <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-500 dark:text-slate-400">
          {job.unit_usaha && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {job.unit_usaha}</span>}
          {job.tipe_kerja && <span className="inline-flex items-center gap-1"><Briefcase className="w-3 h-3" /> {job.tipe_kerja}</span>}
          {job.kuota ? <span className="inline-flex items-center gap-1"><Users2 className="w-3 h-3" /> {job.kuota} orang</span> : null}
          {job.batas_lamaran && <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300"><CalendarClock className="w-3 h-3" /> s/d {formatDate(job.batas_lamaran)}</span>}
        </div>
        {job.deskripsi && (
          <div className="mt-4">
            <div className={`${T.sectionLabel} mb-1`}>Deskripsi Pekerjaan</div>
            <p className="text-slate-600 dark:text-slate-300 text-sm whitespace-pre-wrap">{job.deskripsi}</p>
          </div>
        )}
        {job.persyaratan && (
          <div className="mt-4">
            <div className={`${T.sectionLabel} mb-1`}>Persyaratan</div>
            <p className="text-slate-600 dark:text-slate-300 text-sm whitespace-pre-wrap">{job.persyaratan}</p>
          </div>
        )}
      </div>

      <form ref={formRef} onSubmit={submit} className={`${T.panel} p-6 space-y-6`}>
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-50">Form Lamaran</h2>
          <p className={T.subtitle}>Isi data berikut dengan benar. Tanda <span className="text-rose-600 dark:text-rose-400">*</span> wajib diisi.</p>
        </div>

        <div>
          <div className={`${T.sectionLabel} mb-3`}>Data Diri</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nama Lengkap" wajib>
              <Input required value={form.nama} data-testid="lamar-nama"
                onChange={(e) => set("nama", e.target.value)} className={FORM.input} />
            </Field>
            <Field label="NIK (KTP)" wajib hint="16 digit sesuai KTP">
              <Input required inputMode="numeric" value={form.nik} data-testid="lamar-nik"
                placeholder="16 digit angka"
                onChange={(e) => set("nik", e.target.value)} className={FORM.input} />
            </Field>
            <Field label="Nomor HP / WhatsApp" wajib>
              <Input required value={form.no_hp} data-testid="lamar-hp"
                onChange={(e) => set("no_hp", e.target.value)} className={FORM.input} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} data-testid="lamar-email"
                onChange={(e) => set("email", e.target.value)} className={FORM.input} />
            </Field>
            <Field label="Tanggal Lahir" wajib
              hint={umur === null ? "" : `Umur Anda ${umur} tahun`}>
              <Input required type="date" value={form.tanggal_lahir} data-testid="lamar-lahir"
                onChange={(e) => set("tanggal_lahir", e.target.value)} className={FORM.date} />
            </Field>
            <Field label="Status Pernikahan">
              <Select value={form.status_pernikahan} onValueChange={(v) => set("status_pernikahan", v)}>
                <SelectTrigger className={FORM.select} data-testid="lamar-pernikahan">
                  <SelectValue placeholder="Pilih..." />
                </SelectTrigger>
                <SelectContent className={T.selectContent}>
                  {(info.pilihan.status_pernikahan || []).map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Pendidikan Terakhir">
              <Select value={form.pendidikan_terakhir} onValueChange={(v) => set("pendidikan_terakhir", v)}>
                <SelectTrigger className={FORM.select} data-testid="lamar-pendidikan">
                  <SelectValue placeholder="Pilih..." />
                </SelectTrigger>
                <SelectContent className={T.selectContent}>
                  {(info.pilihan.pendidikan_terakhir || []).map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Domisili" hint="Kota tempat tinggal sekarang">
              <Input value={form.domisili} data-testid="lamar-domisili"
                onChange={(e) => set("domisili", e.target.value)} className={FORM.input} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Alamat Sesuai KTP" wajib>
                <Textarea required rows={2} value={form.alamat} data-testid="lamar-alamat"
                  onChange={(e) => set("alamat", e.target.value)} className={FORM.input} />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Pengalaman Kerja" hint="Perusahaan, posisi, dan lama bekerja. Kosongkan kalau belum ada.">
                <Textarea rows={3} value={form.pengalaman_kerja} data-testid="lamar-pengalaman"
                  onChange={(e) => set("pengalaman_kerja", e.target.value)} className={FORM.input} />
              </Field>
            </div>
          </div>
        </div>

        <div>
          <div className={`${T.sectionLabel} mb-1`}>Berkas</div>
          <p className={`${T.hint} mb-3`}>
            Format {info.tipe_diterima}, maksimal {info.max_file_mb} MB per berkas.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(info.berkas || []).map((b) => (
              <Field key={b.key} label={b.label} wajib={b.wajib}
                hint={berkas[b.key] ? `${berkas[b.key].name} (${(berkas[b.key].size / 1024 / 1024).toFixed(1)} MB)` : ""}>
                <label className={`${FORM.input} h-10 flex items-center gap-2 px-3 rounded-md cursor-pointer text-sm
                  ${berkas[b.key] ? "text-slate-800 dark:text-slate-200" : "text-slate-500"}`}>
                  <Paperclip className="w-4 h-4 shrink-0" />
                  <span className="truncate">{berkas[b.key] ? "Ganti berkas" : "Pilih berkas..."}</span>
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                    data-testid={`lamar-berkas-${b.key}`}
                    onChange={(e) => setBerkas((s) => ({ ...s, [b.key]: e.target.files?.[0] || null }))} />
                </label>
              </Field>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200 text-sm"
            data-testid="lamar-error">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className={T.hint}>
            Data Anda hanya digunakan untuk proses rekrutmen di {job.unit_usaha || "perusahaan kami"}.
          </p>
          <Button type="submit" disabled={kirim} className={T.btnPrimary} data-testid="lamar-kirim">
            <Send className="w-4 h-4 mr-2" /> {kirim ? "Mengirim..." : "Kirim Lamaran"}
          </Button>
        </div>
      </form>
    </PortalShell>
  );
}
