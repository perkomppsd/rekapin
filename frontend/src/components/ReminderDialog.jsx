// Dialog Opsi Kirim Reminder (Pilih Target, Template, Scope, Tanggal & Jam sebelum kirim)

import React, { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, describeApiError } from "@/lib/api";
import { toast } from "sonner";
import { Bell, Send, Mail, Users, Calendar, Clock, Eye, Sparkles } from "lucide-react";
import { useMeta } from "@/context/MetaContext";
import { T } from "@/config/theme";
import VisualRichEditor from "@/components/VisualRichEditor";

export default function ReminderDialog({ open, onOpenChange, selectedIds = [] }) {
  const { email_templates: templates = [] } = useMeta();

  const [targetType, setTargetType] = useState("candidates"); // "candidates" | "internal_team"
  const [scope, setScope] = useState(selectedIds.length > 0 ? "selected" : "all_active");
  const [tpl, setTpl] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Form custom Tanggal, Jam, Metode & Link
  const [customTanggal, setCustomTanggal] = useState(new Date().toISOString().split("T")[0]);
  const [customJam, setCustomJam] = useState("09:00 WIB");
  const [customMetode, setCustomMetode] = useState("Offline");
  const [customLink, setCustomLink] = useState("");
  const [customCatatan, setCustomCatatan] = useState("");

  // Update scope default saat selectedIds berubah
  useEffect(() => {
    if (selectedIds.length > 0) {
      setScope("selected");
    } else if (scope === "selected") {
      setScope("all_active");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  // Set template pertama saat modal terbuka
  useEffect(() => {
    if (!open) return;
    const reminderTpl = templates.find((t) => t.id.includes("reminder")) || templates[0];
    if (reminderTpl) {
      setTpl(reminderTpl.id);
      setSubject(reminderTpl.subject || "");
      let rawBody = reminderTpl.body || "";
      rawBody = rawBody
        .replace(/<p>/gi, "")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .trim();
      setBody(rawBody);
    }
  }, [open, templates]);

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

  const substituteValues = (text) => {
    if (!text) return "";
    const tgl = customTanggal || "Akan diinfokan";
    const jam = customJam || "09:00 WIB";
    const metode = customMetode || "Offline";
    const linkVal = customLink || (customMetode === "Online" ? "https://meet.google.com/abc-defg-hij" : customCatatan || "Kantor Pusat");

    return text
      .replace(/\$nama/g, "[Nama Kandidat]")
      .replace(/\$posisi/g, "[Posisi]")
      .replace(/\$posisi_final/g, "[Posisi]")
      .replace(/\$tanggal/g, tgl)
      .replace(/\$jam/g, jam)
      .replace(/\$metode/g, metode)
      .replace(/\$link_online/g, linkVal)
      .replace(/\$link/g, linkVal)
      .replace(/\$penempatan/g, customCatatan || "Kantor Pusat");
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await api.post("/candidates/send-bulk-reminder", {
        target_type: targetType,
        template: tpl,
        subject: subject,
        body: body,
        scope: scope,
        candidate_ids: selectedIds,
        custom_tanggal: customTanggal,
        custom_jam: customJam,
        custom_metode: customMetode,
        custom_link: customLink,
        custom_catatan: customCatatan,
      });

      if (targetType === "internal_team") {
        toast.success("Reminder ringkasan kandidat dikirim ke email internal tim.");
      } else {
        toast.success(`Berhasil mengirim email reminder ke ${res.data?.sent_count || 0} kandidat!`);
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(describeApiError(e, "Gagal mengirim reminder"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`w-[calc(100vw-1.5rem)] sm:w-full sm:max-w-3xl ${T.dialog} max-h-[92vh] overflow-y-auto p-4 sm:p-6`}>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" /> Kirim Email Reminder / Pengingat
          </DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400">
            Pilih target penerima, preset template, dan tanggal/jam sebelum mengirimkan email reminder.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Target Penerima */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className={T.label}>Target Penerima Email</Label>
              <Select value={targetType} onValueChange={setTargetType}>
                <SelectTrigger className={T.input}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={T.selectContent}>
                  <SelectItem value="candidates">🎯 Email Pengingat ke Kandidat</SelectItem>
                  <SelectItem value="internal_team">📊 Email Ringkasan Rekap ke Tim HR (Internal)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {targetType === "candidates" && (
              <div>
                <Label className={T.label}>Cakupan / Penerima Kandidat</Label>
                <Select value={scope} onValueChange={setScope}>
                  <SelectTrigger className={T.input}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={T.selectContent}>
                    {selectedIds.length > 0 && (
                      <SelectItem value="selected">
                        Dicentang ({selectedIds.length} Kandidat Terpilih)
                      </SelectItem>
                    )}
                    <SelectItem value="training">Kandidat Tahap Interview & Training</SelectItem>
                    <SelectItem value="all_active">Semua Kandidat Aktif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {targetType === "candidates" && (
            <>
              {/* Preset Template */}
              <div>
                <Label className={T.label}>Pilih Preset Template</Label>
                <Select value={tpl} onValueChange={handleSelectTemplate}>
                  <SelectTrigger className={T.input}>
                    <SelectValue placeholder="Pilih template..." />
                  </SelectTrigger>
                  <SelectContent className={T.selectContent}>
                    {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Form Input Cepat Tanggal, Jam, Metode & Link */}
              <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/30 space-y-3">
                <div className="text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Pengisian Otomatis (Tanggal, Jam, Metode & Link)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div>
                    <Label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Tanggal</Label>
                    <Input
                      type="date"
                      value={customTanggal}
                      onChange={(e) => setCustomTanggal(e.target.value)}
                      className="h-8 text-xs bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-900"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Jam</Label>
                    <Input
                      type="text"
                      value={customJam}
                      onChange={(e) => setCustomJam(e.target.value)}
                      placeholder="09:00 WIB"
                      className="h-8 text-xs bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-900"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Metode</Label>
                    <Select value={customMetode} onValueChange={setCustomMetode}>
                      <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-900">
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
                      {customMetode === "Online" ? "🔗 Link Online" : "📍 Lokasi Penempatan"}
                    </Label>
                    <Input
                      type="text"
                      value={customMetode === "Online" ? customLink : customCatatan}
                      onChange={(e) => customMetode === "Online" ? setCustomLink(e.target.value) : setCustomCatatan(e.target.value)}
                      placeholder={customMetode === "Online" ? "https://meet.google.com/xyz" : "Ruang HRD Lt. 2"}
                      className="h-8 text-xs bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-900"
                    />
                  </div>
                </div>
              </div>

              {/* Subjek */}
              <div>
                <Label className={T.label}>Subjek Email</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className={T.input}
                  placeholder="Subjek email..."
                />
              </div>

              {/* Visual Editor Pesan */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className={T.label}>Isi Pesan Email (Visual Editor - Tanpa HTML)</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPreview(!showPreview)}
                    className="h-6 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 px-2 rounded-md"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" /> {showPreview ? "Sembunyikan Preview" : "Lihat Hasil"}
                  </Button>
                </div>
                <VisualRichEditor
                  value={body}
                  onChange={setBody}
                  placeholder="Isi pesan email..."
                />
              </div>

              {/* Live Preview */}
              {showPreview && (
                <div className="p-4 rounded-xl border border-amber-500/30 bg-white dark:bg-slate-950 space-y-2">
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
            </>
          )}

          {targetType === "internal_team" && (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              Email ringkasan laporan rekap kandidat akan dikirimkan otomatis ke alamat email seluruh Admin & Recruiter terdaftar.
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className={T.btnGhostPlain}>Batal</Button>
          <Button onClick={handleSend} disabled={sending} className={T.btnPrimary}>
            <Send className="w-4 h-4 mr-2" />
            {sending ? "Mengirim..." : "Kirim Reminder Sekarang"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
