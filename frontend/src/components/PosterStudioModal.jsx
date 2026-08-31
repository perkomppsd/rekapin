import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import html2canvas from "html2canvas";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Download, Sparkles, QrCode, Palette, Plus, Trash2, Layers
} from "lucide-react";
import { FORM, T, tone } from "@/config/theme";
import { api, describeApiError } from "@/lib/api";

const PRESET_MODELS = [
  {
    id: "peci_navy",
    name: "Staff PPSD (Peci & Kemeja)",
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "hijab_formal",
    name: "Staff Wanita (Hijab Formal)",
    url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "executive_man",
    name: "Professional Executive",
    url: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80",
  },
];

const THEMES = {
  emerald: {
    name: "PPSD Green (Khas Sunan Drajat)",
    primary: "#0B3B18",
    accent: "#166534",
    textHighlight: "#14532D",
    bgSoft: "#F0F7F2",
    pillBg: "#0B3B18",
    pillText: "#FFFFFF",
    cardBorder: "#D1E7DD",
  },
  navy: {
    name: "Navy Executive",
    primary: "#0F172A",
    accent: "#1E3A8A",
    textHighlight: "#1E40AF",
    bgSoft: "#F1F5F9",
    pillBg: "#0F172A",
    pillText: "#FFFFFF",
    cardBorder: "#CBD5E1",
  },
  gold: {
    name: "Gold Luxury",
    primary: "#451A03",
    accent: "#78350F",
    textHighlight: "#92400E",
    bgSoft: "#FFFBEB",
    pillBg: "#451A03",
    pillText: "#FEF3C7",
    cardBorder: "#FDE68A",
  },
  dark: {
    name: "Dark Modern",
    primary: "#18181B",
    accent: "#27272A",
    textHighlight: "#3B82F6",
    bgSoft: "#18181B",
    pillBg: "#27272A",
    pillText: "#F4F4F5",
    cardBorder: "#3F3F46",
    isDark: true,
  },
};

export default function PosterStudioModal({ open, onOpenChange, job, onPosterUploaded }) {
  const posterRef = useRef(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [savingPoster, setSavingPoster] = useState(false);
  const [themeKey, setThemeKey] = useState("emerald");
  const [activeTab, setActiveTab] = useState("preview"); // "controls" | "preview"

  // Form State Poster
  const [judul, setJudul] = useState("");
  const [unitUsaha, setUnitUsaha] = useState("");
  const [lokasi, setLokasi] = useState("");
  const [kualifikasi, setKualifikasi] = useState([]);
  const [persyaratan, setPersyaratan] = useState([]);
  const [linkPendaftaran, setLinkPendaftaran] = useState("");
  const [igHandle, setIgHandle] = useState("@PERKOM_PPSD");
  const [waHotline, setWaHotline] = useState("0851-2222-2204");
  const [websiteUrl, setWebsiteUrl] = useState("PEREKONOMIAN.PPSD.ID");
  const [modelUrl, setModelUrl] = useState(PRESET_MODELS[0].url);

  const theme = THEMES[themeKey] || THEMES.emerald;

  // Sync state saat job dibuka
  useEffect(() => {
    if (job) {
      setJudul(job.judul || "STAFF REKRUTMEN");
      setUnitUsaha(job.unit_usaha || "SUNDRA ARENA");
      setLokasi(job.lokasi || "Dagan, Kec. Solokuro, Kab. Lamongan");
      
      // Auto parse bullet points dari kualifikasi & deskripsi
      const kualArray = job.persyaratan
        ? job.persyaratan.split("\n").map(s => s.replace(/^[-*•]\s*/, "").trim()).filter(Boolean)
        : [
            "Laki-Laki",
            "Usia maksimal 27 Tahun",
            "Pendidikan minimal SMA/SMK sederajat",
            "Bisa mengoperasikan komputer",
            "Memiliki minat dan faham dunia sepak bola",
            "Bisa membaca Al-Qur'an",
            "Mampu bekerja dalam tim maupun individu",
            "Siap bekerja shift",
            "Tidak terikat organisasi/perusahaan lain",
          ];
      setKualifikasi(kualArray);

      const persyarArray = [
        "Surat Lamaran",
        "Fotocopy KTP",
        "Fotocopy Ijazah",
        "Fotocopy SKCK",
        "Pas Foto Berwarna 3x4",
        "Daftar Riwayat Hidup",
      ];
      setPersyaratan(persyarArray);

      const defaultLink = `${window.location.origin}/lowongan/${job.slug || job.id}`;
      setLinkPendaftaran(defaultLink);
    }
  }, [job]);

  // Generate QR Code saat linkPendaftaran berubah
  useEffect(() => {
    if (linkPendaftaran) {
      QRCode.toDataURL(linkPendaftaran, { width: 300, margin: 1, color: { dark: "#000000", light: "#ffffff" } })
        .then(url => setQrDataUrl(url))
        .catch(err => console.error("QR Code Error:", err));
    }
  }, [linkPendaftaran]);

  const handleAddKualifikasi = () => setKualifikasi([...kualifikasi, "Poin kualifikasi baru"]);
  const handleRemoveKualifikasi = (idx) => setKualifikasi(kualifikasi.filter((_, i) => i !== idx));
  const handleUpdateKualifikasi = (idx, val) => {
    const copy = [...kualifikasi];
    copy[idx] = val;
    setKualifikasi(copy);
  };

  const handleAddPersyaratan = () => setPersyaratan([...persyaratan, "Dokumen persyaratan baru"]);
  const handleRemovePersyaratan = (idx) => setPersyaratan(persyaratan.filter((_, i) => i !== idx));
  const handleUpdatePersyaratan = (idx, val) => {
    const copy = [...persyaratan];
    copy[idx] = val;
    setPersyaratan(copy);
  };

  // Upload Custom Model / Logo
  const handleImageUpload = (e, setter) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setter(event.target.result);
      reader.readAsDataURL(file);
    }
  };

  // Render Canvas to Blob
  const generatePosterBlob = async () => {
    if (!posterRef.current) return null;
    const canvas = await html2canvas(posterRef.current, {
      scale: 2.5,
      useCORS: true,
      logging: false,
      backgroundColor: theme.isDark ? "#18181B" : "#F0F7F2",
    });
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
  };

  // Unduh Poster PNG
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await generatePosterBlob();
      if (!blob) throw new Error("Gagal memproses gambar");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Poster-Loker-${judul.replace(/\s+/g, "-")}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Poster berhasil diunduh!");
    } catch (e) {
      toast.error(e.message || "Gagal mengunduh poster");
    } finally {
      setDownloading(false);
    }
  };

  // Simpan & Pasang sebagai Poster Lowongan
  const handleSaveToJob = async () => {
    if (!job?.id) return;
    setSavingPoster(true);
    try {
      const blob = await generatePosterBlob();
      if (!blob) throw new Error("Gagal membuat file poster");
      const file = new File([blob], `poster-${job.id}.png`, { type: "image/png" });
      const formData = new FormData();
      formData.append("file", file);

      await api.post(`/lowongan/${job.id}/poster`, formData);
      toast.success("Poster berhasil dipasang ke lowongan!");
      if (onPosterUploaded) onPosterUploaded();
      onOpenChange(false);
    } catch (e) {
      toast.error(describeApiError(e, "Gagal memasang poster ke lowongan"));
    } finally {
      setSavingPoster(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`w-[calc(100vw-1rem)] sm:w-full sm:max-w-6xl ${T.dialog} max-h-[95vh] overflow-hidden p-0 flex flex-col`}>
        <DialogHeader className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
            <div>
              <DialogTitle className="font-display text-xl">Poster Studio & QR Code Generator</DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Buat flyer info loker profesional ber-QR Code langsung dari data lowongan.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Mobile Tab Switcher */}
        <div className="flex lg:hidden border-b border-slate-200 dark:border-slate-800 bg-slate-200/60 dark:bg-slate-900 p-1 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("controls")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "controls"
                ? "bg-white dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            📝 Edit Form & Teks
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "preview"
                ? "bg-white dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            🖼️ Preview Poster & QR
          </button>
        </div>

        {/* Studio Body: 2 Panel Grid */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* PANEL KIRI: Controls & Form Input (5 Columns) */}
          <div className={`${activeTab === "controls" ? "block" : "hidden"} lg:block lg:col-span-5 p-5 overflow-y-auto space-y-5 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950`}>
            {/* Pilihan Tema Warna */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Palette className="w-3.5 h-3.5 text-indigo-500" /> Tema Warna Poster
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(THEMES).map(([key, t]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setThemeKey(key)}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-medium text-left transition-all ${
                      themeKey === key
                        ? "border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full shrink-0 border border-black/10 shadow-sm" style={{ backgroundColor: t.primary }} />
                    <span className="truncate">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Form Input Header */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-900">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Header & Posisi</Label>
              <div>
                <Label className={T.hint}>Judul Posisi (We Are Hiring)</Label>
                <Input value={judul} onChange={(e) => setJudul(e.target.value)} className={FORM.input} placeholder="STAFF SUNDRA ARENA" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className={T.hint}>Unit Usaha</Label>
                  <Input value={unitUsaha} onChange={(e) => setUnitUsaha(e.target.value)} className={FORM.input} placeholder="SUNDRA ARENA" />
                </div>
                <div>
                  <Label className={T.hint}>Lokasi / Alamat</Label>
                  <Input value={lokasi} onChange={(e) => setLokasi(e.target.value)} className={FORM.input} placeholder="Lamongan" />
                </div>
              </div>
            </div>

            {/* Maskot & Model Photo */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-900">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Foto Model / Maskot</span>
                <label className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
                  + Upload Custom
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setModelUrl)} />
                </label>
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {PRESET_MODELS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModelUrl(m.url)}
                    className={`relative rounded-lg overflow-hidden border-2 aspect-square text-left transition-all ${
                      modelUrl === m.url ? "border-indigo-600 ring-2 ring-indigo-500/20" : "border-slate-200 dark:border-slate-800 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 inset-x-0 bg-slate-900/80 text-[9px] text-white p-1 truncate leading-tight text-center">
                      {m.name.split(" ")[0]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* List Kualifikasi */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-900">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Kualifikasi ({kualifikasi.length})</Label>
                <Button type="button" size="sm" variant="ghost" onClick={handleAddKualifikasi} className="h-6 px-2 text-[11px] text-indigo-600 dark:text-indigo-400">
                  <Plus className="w-3 h-3 mr-1" /> Tambah
                </Button>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {kualifikasi.map((k, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <Input
                      value={k}
                      onChange={(e) => handleUpdateKualifikasi(idx, e.target.value)}
                      className="h-8 text-xs bg-slate-50 dark:bg-slate-900"
                    />
                    <Button type="button" size="icon" variant="ghost" onClick={() => handleRemoveKualifikasi(idx)} className="h-8 w-8 text-rose-500 shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* List Persyaratan Berkas */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-900">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Persyaratan Berkas ({persyaratan.length})</Label>
                <Button type="button" size="sm" variant="ghost" onClick={handleAddPersyaratan} className="h-6 px-2 text-[11px] text-indigo-600 dark:text-indigo-400">
                  <Plus className="w-3 h-3 mr-1" /> Tambah
                </Button>
              </div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {persyaratan.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <Input
                      value={p}
                      onChange={(e) => handleUpdatePersyaratan(idx, e.target.value)}
                      className="h-8 text-xs bg-slate-50 dark:bg-slate-900"
                    />
                    <Button type="button" size="icon" variant="ghost" onClick={() => handleRemovePersyaratan(idx)} className="h-8 w-8 text-rose-500 shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Link Pendaftaran & Contact Info */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-900">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Link & Kontak Poster</Label>
              <div>
                <Label className={T.hint}>URL Pendaftaran (Terkoneksi ke QR Code)</Label>
                <Input value={linkPendaftaran} onChange={(e) => setLinkPendaftaran(e.target.value)} className={FORM.input} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className={T.hint}>Instagram</Label>
                  <Input value={igHandle} onChange={(e) => setIgHandle(e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className={T.hint}>WhatsApp</Label>
                  <Input value={waHotline} onChange={(e) => setWaHotline(e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className={T.hint}>Website</Label>
                  <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
            </div>
          </div>

          {/* PANEL KANAN: Canvas Live Preview (7 Columns) */}
          <div className={`${activeTab === "preview" ? "flex" : "hidden"} lg:flex lg:col-span-7 p-4 sm:p-6 overflow-y-auto bg-slate-100 dark:bg-slate-900 flex-col items-center justify-center relative`}>
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5 font-medium">
              <Layers className="w-3.5 h-3.5" /> Live Preview Visual Poster (Ratio 4:5 Ready for IG / Banner)
            </div>

            {/* POSTER CANVAS FRAME (STRICT 4:5 RATIO FOR INSTAGRAM & FLYER) */}
            <div
              ref={posterRef}
              className="w-full max-w-[440px] aspect-[4/5] shadow-2xl rounded-3xl overflow-hidden relative flex flex-col justify-between select-none transition-all p-3.5 space-y-1.5 shrink-0"
              style={{
                backgroundColor: theme.bgSoft,
                color: theme.isDark ? "#FFFFFF" : "#0F172A",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              {/* TOP HEADER: DUAL LOGOS, TITLE & MODEL FRAME */}
              <div className="space-y-1.5">
                {/* LOGO & MODEL TOP ROW */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1 min-w-0 pr-1">
                    {/* DUAL LOGOS */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1 bg-white/95 dark:bg-slate-950/95 px-2 py-0.5 rounded-md shadow-xs border border-slate-200/60 dark:border-slate-800 backdrop-blur-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        <span className="font-bold text-[9px] text-slate-900 dark:text-slate-100 tracking-tight leading-none">
                          Perekonomian<br />
                          <span className="text-emerald-700 dark:text-emerald-400 font-extrabold text-[9.5px]">Sunan Drajat</span>
                        </span>
                      </div>
                      {unitUsaha && (
                        <div className="bg-emerald-950 text-white font-extrabold text-[8.5px] px-1.5 py-0.5 rounded-md shadow-xs tracking-wider uppercase border border-emerald-700/50 flex items-center gap-1">
                          ⚽ <span className="truncate max-w-[90px]">{unitUsaha}</span>
                        </div>
                      )}
                    </div>

                    {/* HEADLINE TEXT */}
                    <div className="pt-0.5">
                      <div className="text-[10px] font-black tracking-[0.18em] text-slate-700 dark:text-slate-300 uppercase">
                        WE ARE HIRING
                      </div>
                      <h1
                        className="text-lg sm:text-xl font-black leading-[1.05] uppercase tracking-tight break-words line-clamp-2"
                        style={{ color: theme.textHighlight }}
                      >
                        {judul}
                      </h1>
                    </div>
                  </div>

                  {/* MODEL / MASKOT PHOTO FRAME */}
                  {modelUrl && (
                    <div className="w-22 h-24 sm:w-24 sm:h-26 shrink-0 rounded-xl overflow-hidden shadow-md border-2 border-white/80 dark:border-slate-800 relative bg-slate-200 dark:bg-slate-800">
                      <img
                        src={modelUrl}
                        alt="Model"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>

                {/* PILL HEADER: UNIT & LOKASI */}
                <div
                  className="p-1.5 px-2.5 rounded-lg shadow-xs flex flex-col items-center justify-center text-center border border-white/20"
                  style={{ backgroundColor: theme.pillBg, color: theme.pillText }}
                >
                  <div className="font-extrabold text-[11px] tracking-wider uppercase leading-none">{unitUsaha}</div>
                  <div className="text-[9px] opacity-90 font-medium leading-tight truncate max-w-full">{lokasi}</div>
                </div>
              </div>

              {/* CARD CONTENT: KUALIFIKASI (2 COLUMNS FIT TO PREVENT OVERFLOW) */}
              <div className="bg-white/90 dark:bg-slate-900/90 rounded-xl p-2.5 shadow-xs border space-y-1" style={{ borderColor: theme.cardBorder }}>
                <div
                  className="py-0.5 px-2.5 rounded-md font-extrabold text-center text-[10px] tracking-widest uppercase shadow-xs"
                  style={{ backgroundColor: theme.primary, color: "#FFFFFF" }}
                >
                  KUALIFIKASI
                </div>
                <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] leading-tight font-medium text-slate-800 dark:text-slate-200 pt-0.5">
                  {kualifikasi.map((k, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <span className="w-1 h-1 rounded-full mt-1 shrink-0" style={{ backgroundColor: theme.primary }} />
                      <span className="truncate">{k}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* BOTTOM GRID: PERSYARATAN & QR CODE */}
              <div className="grid grid-cols-12 gap-2">
                {/* PERSYARATAN BERKAS (7 Cols) */}
                <div className="col-span-7 bg-white/90 dark:bg-slate-900/90 rounded-xl p-2 shadow-xs border flex flex-col justify-between space-y-0.5" style={{ borderColor: theme.cardBorder }}>
                  <div
                    className="py-0.5 px-1.5 rounded-md font-extrabold text-center text-[9px] tracking-wider uppercase shadow-xs"
                    style={{ backgroundColor: theme.primary, color: "#FFFFFF" }}
                  >
                    KIRIMKAN SEGERA
                  </div>
                  <ul className="space-y-0.5 text-[8.5px] leading-tight font-medium text-slate-800 dark:text-slate-200">
                    {persyaratan.map((p, idx) => (
                      <li key={idx} className="flex items-center gap-1">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[9px]">✓</span>
                        <span className="truncate">{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* QR CODE & LINK (5 Cols) */}
                <div className="col-span-5 bg-white/90 dark:bg-slate-900/90 rounded-xl p-1.5 shadow-xs border flex flex-col items-center justify-between text-center space-y-0.5" style={{ borderColor: theme.cardBorder }}>
                  <div className="text-[8.5px] font-bold text-slate-800 dark:text-slate-200 leading-tight">
                    Scan QR Melamar:
                  </div>
                  {qrDataUrl ? (
                    <div className="p-0.5 bg-white rounded-md shadow-xs border border-slate-200">
                      <img src={qrDataUrl} alt="QR Code" className="w-11 h-11 object-contain" />
                    </div>
                  ) : (
                    <QrCode className="w-9 h-9 text-slate-400" />
                  )}
                  <div className="text-[7px] text-rose-600 dark:text-rose-400 font-semibold leading-none">
                    *Online via QR
                  </div>
                </div>
              </div>

              {/* FOOTER BAR */}
              <div
                className="p-1.5 px-2.5 rounded-md flex items-center justify-between text-[8px] font-bold tracking-tight shrink-0"
                style={{ backgroundColor: theme.primary, color: "#FFFFFF" }}
              >
                <div className="flex items-center gap-0.5 truncate">
                  <span>📸</span> <span className="truncate">{igHandle}</span>
                </div>
                <div className="flex items-center gap-0.5 truncate">
                  <span>💬</span> <span className="truncate">{waHotline}</span>
                </div>
                <div className="flex items-center gap-0.5 truncate">
                  <span>🌐</span> <span className="truncate">{websiteUrl}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-4 px-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className={T.btnGhostPlain}>
            Tutup Studio
          </Button>

          <div className="flex items-center gap-2">
            {job?.id && (
              <Button
                type="button"
                variant="outline"
                disabled={savingPoster}
                onClick={handleSaveToJob}
                className={`rounded-full pill-btn ${tone("indigo", "button")}`}
              >
                {savingPoster ? "Memasang..." : "📌 Pasang ke Lowongan"}
              </Button>
            )}
            <Button
              type="button"
              disabled={downloading}
              onClick={handleDownload}
              className={T.btnPrimary}
            >
              <Download className="w-4 h-4 mr-2" />
              {downloading ? "Mengunduh..." : "Unduh Poster PNG High-Res"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
