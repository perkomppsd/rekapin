import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { api, describeApiError } from "@/lib/api";
import { toast } from "sonner";
import { Send, Mail, Settings, Calendar, Clock, MapPin, Bold, Italic, List, Eye } from "lucide-react";
import { useMeta } from "@/context/MetaContext";
import { T } from "@/config/theme";
import VisualRichEditor from "@/components/VisualRichEditor";

const PLACEHOLDERS = [
  { tag: "$nama", label: "Nama", icon: "👤" },
  { tag: "$posisi", label: "Posisi", icon: "💼" },
  { tag: "$tanggal", label: "Tanggal", icon: "📅" },
  { tag: "$jam", label: "Jam", icon: "⏰" },
  { tag: "$metode", label: "Metode", icon: "💻" },
  { tag: "$penempatan", label: "Penempatan", icon: "📍" },
];

export default function EmailTemplateDialog({ open, onOpenChange, candidate }) {
  const { email_templates: templates = [] } = useMeta();
  const [tpl, setTpl] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [activeField, setActiveField] = useState("body");
  const [showPreview, setShowPreview] = useState(false);

  // Form custom Tanggal, Jam, Metode, Link Online & Catatan
  const [customTanggal, setCustomTanggal] = useState("");
  const [customJam, setCustomJam] = useState("09:00 WIB");
  const [customMetode, setCustomMetode] = useState("Offline");
  const [customLink, setCustomLink] = useState("");
  const [customCatatan, setCustomCatatan] = useState("");

  const subjectRef = useRef(null);
  const bodyRef = useRef(null);

  // Inisialisasi data kandidat & template saat modal terbuka
  useEffect(() => {
    if (!open) return;
    if (candidate) {
      setCustomTanggal(candidate.tanggal_interview || new Date().toISOString().split("T")[0]);
      setCustomJam(candidate.jam_interview || "09:00 WIB");
      setCustomMetode(candidate.metode_interview || "Offline");
      setCustomLink(candidate.link_online || candidate.link || "");
      setCustomCatatan(candidate.penempatan_fix || candidate.rencana_penempatan || "");
    }

    const selected = templates.find((t) => t.id === tpl) || templates[0];
    if (selected) {
      if (!tpl) setTpl(selected.id);
      setSubject(selected.subject || "");

      let rawBody = selected.body || "";
      rawBody = rawBody
        .replace(/<p>/gi, "")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .trim();

      setBody(rawBody);
    }
  }, [open, tpl, templates, candidate]);

  const handleSelectTemplate = (val) => {
    setTpl(val);
    const selected = templates.find((t) => t.id === val);
    if (selected) {
      setSubject(selected.subject || "");
      let rawBody = selected.body || "";
      rawBody = rawBody
        .replace(/<p>/gi, "")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .trim();
      setBody(rawBody);
    }
  };

  // Render teks dengan nilai pengganti otomatis dari form custom
  const substituteValues = (text) => {
    if (!text) return "";
    const name = candidate?.nama || "Budi Santoso";
    const pos = candidate?.apply || candidate?.posisi_penempatan || "Staff HR";
    const penempatan = customCatatan || candidate?.penempatan_fix || candidate?.rencana_penempatan || "Kantor Pusat";
    const tgl = customTanggal || "Akan diinfokan";
    const jam = customJam || "09:00 WIB";
    const metode = customMetode || "Offline";
    const linkVal = customLink || (customMetode === "Online" ? "https://meet.google.com/abc-defg-hij" : penempatan);

    return text
      .replace(/\$nama/g, name)
      .replace(/\$posisi/g, pos)
      .replace(/\$posisi_final/g, pos)
      .replace(/\$tanggal/g, tgl)
      .replace(/\$jam/g, jam)
      .replace(/\$metode/g, metode)
      .replace(/\$link_online/g, linkVal)
      .replace(/\$link/g, linkVal)
      .replace(/\$penempatan/g, penempatan)
      .replace(/\$email_kandidat/g, candidate?.email || "")
      .replace(/\$no_hp/g, candidate?.no_hp || "");
  };

  const send = async () => {
    if (!candidate?.id) return;
    if (!candidate.email) {
      toast.error("Email kandidat kosong. Edit dulu data kandidat untuk isi email.");
      return;
    }
    setSending(true);

    const finalSubject = substituteValues(subject);
    let finalBody = substituteValues(body);

    if (!finalBody.includes("<p>") && !finalBody.includes("<div>")) {
      finalBody = finalBody
        .split("\n\n")
        .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
        .join("\n");
    }

    try {
      await api.post(`/candidates/${candidate.id}/send-email`, {
        template: tpl || "custom",
        subject: finalSubject,
        body: finalBody,
      });
      toast.success(`Email terkirim ke ${candidate.email}`);
      onOpenChange(false);
    } catch (e) {
      toast.error(describeApiError(e, "Gagal kirim email"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`w-[calc(100vw-1.5rem)] sm:w-full sm:max-w-3xl ${T.dialog} max-h-[92vh] overflow-y-auto p-4 sm:p-6`}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="font-display text-2xl flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Kirim Email & Undangan
            </DialogTitle>
            <Link
              to="/settings"
              onClick={() => onOpenChange(false)}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
            >
              <Settings className="w-3.5 h-3.5" /> Kelola Template di Setting
            </Link>
          </div>
          <DialogDescription className="text-slate-500 dark:text-slate-400">
            Kirim email ke <span className="text-slate-800 dark:text-slate-200 font-semibold">{candidate?.nama}</span>
            {" "}({candidate?.email || <em className="text-rose-600 dark:text-rose-400">email kosong</em>}). Atur jadwal & tanggal di bawah untuk pengisian pesan otomatis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preset Selector */}
          <div>
            <Label className={T.label}>Pilih Jenis Pesan / Template</Label>
            <Select value={tpl} onValueChange={handleSelectTemplate}>
              <SelectTrigger data-testid="select-email-template" className={T.input}>
                <SelectValue placeholder="Pilih template..." />
              </SelectTrigger>
              <SelectContent className={T.selectContent}>
                {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Form Input Cepat Tanggal, Jam, Metode & Penempatan */}
          <div className="p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 dark:bg-indigo-950/40 space-y-3">
            <div className="text-xs font-semibold text-indigo-800 dark:text-indigo-200 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Pengisian Otomatis (Tanggal, Jam, Metode & Penempatan)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <Label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Tanggal</Label>
                <Input
                  type="date"
                  value={customTanggal}
                  onChange={(e) => setCustomTanggal(e.target.value)}
                  className="h-8 text-xs bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-900"
                />
              </div>
              <div>
                <Label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Jam</Label>
                <Input
                  type="text"
                  value={customJam}
                  onChange={(e) => setCustomJam(e.target.value)}
                  placeholder="09:00 WIB"
                  className="h-8 text-xs bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-900"
                />
              </div>
              <div>
                <Label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Metode</Label>
                <Select value={customMetode} onValueChange={setCustomMetode}>
                  <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={T.selectContent}>
                    <SelectItem value="Offline">Offline (Tatap Muka)</SelectItem>
                    <SelectItem value="Online">Online (Zoom/Meet)</SelectItem>
                    <SelectItem value="Telepon">Telepon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  {customMetode === "Online" ? "🔗 Link Online (Meet/Zoom)" : "📍 Lokasi / Penempatan"}
                </Label>
                <Input
                  type="text"
                  value={customMetode === "Online" ? customLink : customCatatan}
                  onChange={(e) => customMetode === "Online" ? setCustomLink(e.target.value) : setCustomCatatan(e.target.value)}
                  placeholder={customMetode === "Online" ? "https://meet.google.com/xyz-abc-def" : "cth. Ruang HRD Lt. 2"}
                  className={`h-8 text-xs bg-white dark:bg-slate-900 ${
                    customMetode === "Online" ? "border-indigo-500 font-medium text-indigo-700 dark:text-indigo-300" : "border-indigo-200 dark:border-indigo-900"
                  }`}
                />
              </div>
            </div>

            {customMetode === "Online" && (
              <div className="pt-1 flex items-center justify-between gap-2 border-t border-indigo-200/50 dark:border-indigo-900/50">
                <span className="text-[11px] text-slate-600 dark:text-slate-300">
                  Variabel <code className="bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-1 rounded">$link</code> atau <code className="bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-1 rounded">$penempatan</code> otomatis terisi link di atas.
                </span>
                <button
                  type="button"
                  onClick={() => setCustomLink("https://meet.google.com/new")}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 font-medium"
                >
                  + Buat Link Google Meet
                </button>
              </div>
            )}
          </div>

          <div>
            <Label className={T.label}>Subjek Email</Label>
            <Input
              ref={subjectRef}
              onFocus={() => setActiveField("subject")}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={T.input}
              placeholder="Subjek email..."
            />
          </div>

          <div>
            <Label className={T.label}>Isi Pesan Email (Visual Editor - Tanpa Kode HTML)</Label>
            <VisualRichEditor
              value={body}
              onChange={setBody}
              placeholder="Isi pesan email..."
            />
          </div>

          {/* Pratinjau Tampilan Hasil Email */}
          {showPreview && (
            <div className="p-4 rounded-xl border border-indigo-500/30 bg-white dark:bg-slate-950 space-y-2">
              <div className="text-xs text-slate-500 border-b border-slate-100 dark:border-slate-900 pb-1.5">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Subjek Terkirim:</span>{" "}
                <span className="font-bold text-slate-900 dark:text-slate-100">{substituteValues(subject)}</span>
              </div>
              <div
                className="prose dark:prose-invert max-w-none text-xs leading-relaxed"
                dangerouslySetInnerHTML={{ __html: substituteValues(body).replace(/\n/g, "<br/>") }}
              />
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="btn-cancel-email"
            className={T.btnGhostPlain}>Batal</Button>
          <Button onClick={send} disabled={sending || !candidate?.email}
            data-testid="btn-send-email" className={T.btnPrimary}>
            <Send className="w-4 h-4 mr-2" />
            {sending ? "Mengirim..." : "Kirim Email Sekarang"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
