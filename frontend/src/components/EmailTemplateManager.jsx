// Pengelola Template Email (Admin Settings).
// Editor intuitif dengan penyisipan variabel di posisi kursor,
// toolbar format teks instan, dan live preview.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Mail, Plus, Pencil, Trash2, Check, X, Eye, Sparkles, Bold, Italic, List, CornerDownLeft
} from "lucide-react";
import { api, describeApiError } from "@/lib/api";
import { useMeta } from "@/context/MetaContext";
import { T } from "@/config/theme";
import VisualRichEditor from "@/components/VisualRichEditor";

const PLACEHOLDERS = [
  { tag: "$nama", label: "Nama Kandidat", icon: "👤" },
  { tag: "$posisi", label: "Posisi Apply", icon: "💼" },
  { tag: "$tanggal", label: "Tanggal Interview", icon: "📅" },
  { tag: "$jam", label: "Jam Interview", icon: "⏰" },
  { tag: "$metode", label: "Metode (Offline/Online)", icon: "💻" },
  { tag: "$penempatan", label: "Cabang Penempatan", icon: "📍" },
  { tag: "$email_kandidat", label: "Email Kandidat", icon: "✉️" },
  { tag: "$no_hp", label: "No HP Kandidat", icon: "📱" },
];

export default function EmailTemplateManager() {
  const meta = useMeta();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null or template doc
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [activeField, setActiveField] = useState("body"); // "subject" | "body"

  const subjectRef = useRef(null);
  const bodyRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/email-templates");
      setTemplates(data || []);
    } catch (e) {
      toast.error(describeApiError(e, "Gagal memuat template email"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    await load();
    meta.reload?.();
  };

  const handleCreateNew = () => {
    setEditing({
      id: "",
      label: "Template Baru",
      subject: "[Undangan Tes] $posisi — $nama",
      body: "Halo $nama,\n\nTerima kasih telah melamar posisi $posisi dengan rencana penempatan di $penempatan.\n\nKami mengundang Anda untuk mengikuti sesi interview pada:\n• Tanggal: $tanggal\n• Jam: $jam\n• Metode: $metode\n\nMohon konfirmasi kehadiran Anda dengan membalas email ini.\n\nSalam hangat,\nTim Rekrutmen",
      isNew: true,
    });
  };

  // Sisipkan teks / tag persis di posisi kursor aktif
  const insertTextAtCursor = (field, insertTag) => {
    if (!editing) return;
    const inputEl = field === "subject" ? subjectRef.current : bodyRef.current;
    const currentValue = editing[field] || "";

    if (!inputEl) {
      setEditing((prev) => ({ ...prev, [field]: currentValue + insertTag }));
      return;
    }

    const start = inputEl.selectionStart ?? currentValue.length;
    const end = inputEl.selectionEnd ?? currentValue.length;
    const nextValue = currentValue.substring(0, start) + insertTag + currentValue.substring(end);

    setEditing((prev) => ({ ...prev, [field]: nextValue }));

    setTimeout(() => {
      inputEl.focus();
      const newPos = start + insertTag.length;
      inputEl.setSelectionRange(newPos, newPos);
    }, 50);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editing.label.trim() || !editing.subject.trim() || !editing.body.trim()) {
      toast.error("Label, subjek, dan isi pesan wajib diisi");
      return;
    }
    setSaving(true);

    // Otomatis ubah newline (\n) menjadi HTML paragraph jika belum ada tag HTML
    let bodyFormatted = editing.body.trim();
    if (!bodyFormatted.includes("<p>") && !bodyFormatted.includes("<div>")) {
      bodyFormatted = bodyFormatted
        .split("\n\n")
        .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br/>")}</p>`)
        .join("\n");
    }

    try {
      if (editing.isNew) {
        await api.post("/email-templates", {
          label: editing.label,
          subject: editing.subject,
          body: bodyFormatted,
        });
        toast.success(`Template "${editing.label}" dibuat`);
      } else {
        await api.put(`/email-templates/${editing.id}`, {
          label: editing.label,
          subject: editing.subject,
          body: bodyFormatted,
        });
        toast.success(`Template "${editing.label}" diperbarui`);
      }
      setEditing(null);
      await refresh();
    } catch (err) {
      toast.error(describeApiError(err, "Gagal menyimpan template email"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/email-templates/${deleteTarget.id}`);
      toast.success(`Template "${deleteTarget.label}" dihapus`);
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      toast.error(describeApiError(err, "Gagal menghapus template"));
    }
  };

  // Preview simulasi
  const renderPreview = (text) => {
    if (!text) return "";
    let clean = text
      .replace(/\$nama/g, "Budi Santoso")
      .replace(/\$posisi/g, "Staff HR")
      .replace(/\$tanggal/g, "15 September 2026")
      .replace(/\$jam/g, "09:00 WIB")
      .replace(/\$metode/g, "Offline")
      .replace(/\$penempatan/g, "Toserba Payaman")
      .replace(/\$email_kandidat/g, "budi@example.com")
      .replace(/\$no_hp/g, "081234567890");

    if (!clean.includes("<p>") && !clean.includes("<div>")) {
      clean = clean.replace(/\n/g, "<br/>");
    }
    return clean;
  };

  return (
    <div className={`${T.panelSubtle} overflow-hidden`} data-testid="email-template-manager">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-slate-900 dark:text-slate-100 font-medium flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Template Email & Pesan Rekrutmen ({templates.length})
          </div>
          <div className={T.hint}>
            Kelola subjek & isi pesan email undangan/pengingat. Variabel otomatis akan terisi dari data kandidat.
          </div>
        </div>
        <Button
          type="button"
          onClick={handleCreateNew}
          size="sm"
          className={`${T.btnPrimary} shrink-0`}
        >
          <Plus className="w-4 h-4 mr-1.5" /> Buat Template Baru
        </Button>
      </div>

      {/* Form Editor saat Edit / Tambah */}
      {editing && (
        <form onSubmit={handleSave} className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Pencil className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              {editing.isNew ? "Buat Template Email Baru" : `Edit Template: ${editing.label}`}
            </div>
            <span className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full font-medium">
              Mode Input Mudah
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sisi Kiri: Form Edit Teks */}
            <div className="space-y-3">
              <div>
                <Label className={T.label}>Judul / Nama Template</Label>
                <Input
                  required
                  value={editing.label}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  className={T.input}
                  placeholder="cth. Undangan Interview Offline"
                />
              </div>

              <div>
                <Label className={T.label}>Subjek Email</Label>
                <Input
                  ref={subjectRef}
                  required
                  onFocus={() => setActiveField("subject")}
                  value={editing.subject}
                  onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                  className={T.input}
                  placeholder="cth. [Undangan Interview] $posisi — $nama"
                />
              </div>

              <div>
                <Label className={T.label}>Isi Pesan Email (Visual Editor - Tanpa Kode HTML)</Label>
                <VisualRichEditor
                  value={editing.body}
                  onChange={(val) => setEditing({ ...editing, body: val })}
                  placeholder="Ketik isi email di sini..."
                />
              </div>
            </div>

            {/* Sisi Kanan: Live Preview Tampilan Email */}
            <div className="space-y-2">
              <Label className={`${T.label} flex items-center gap-1.5`}>
                <Eye className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Live Preview Tampilan Email
              </Label>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-[360px] space-y-3 shadow-sm">
                <div className="border-b border-slate-100 dark:border-slate-900 pb-2 text-xs">
                  <div className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Subjek Email:</div>
                  <div className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {renderPreview(editing.subject) || <em className="text-slate-400 font-normal">(Subjek kosong)</em>}
                  </div>
                </div>

                <div className="text-xs leading-relaxed space-y-2">
                  <div className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider mb-1">Isi Pesan Email:</div>
                  <div
                    className="prose dark:prose-invert max-w-none text-xs leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: renderPreview(editing.body) }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(null)}
              className={T.btnGhostPlain}
            >
              Batal
            </Button>
            <Button type="submit" size="sm" disabled={saving} className={T.btnPrimary}>
              <Check className="w-4 h-4 mr-1.5" />
              {saving ? "Menyimpan..." : "Simpan Template Email"}
            </Button>
          </div>
        </form>
      )}

      {/* List Templates */}
      {loading ? (
        <div className="text-slate-500 dark:text-slate-400 text-sm text-center py-8">Memuat...</div>
      ) : templates.length === 0 ? (
        <div className="text-slate-500 text-sm text-center py-10">
          Belum ada template email. Tambahkan lewat tombol di atas.
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {templates.map((tpl) => (
            <li key={tpl.id} className="px-4 py-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-900 dark:text-slate-100 font-semibold text-sm">{tpl.label}</span>
                    {tpl.internal ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium">Internal</span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium">Publik</span>
                    )}
                  </div>
                  <div className="text-slate-600 dark:text-slate-300 text-xs mt-1 font-mono truncate">
                    Subjek: {tpl.subject}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      // Bersihkan HTML tags sederhana agar mudah dibaca di mode input
                      let rawBody = tpl.body || "";
                      rawBody = rawBody
                        .replace(/<p>/gi, "")
                        .replace(/<\/p>/gi, "\n\n")
                        .replace(/<br\s*\/?>/gi, "\n");

                      setEditing({
                        id: tpl.id,
                        label: tpl.label,
                        subject: tpl.subject,
                        body: rawBody.trim(),
                        isNew: false,
                      });
                    }}
                    className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:hover:text-slate-50"
                    title="Edit Template"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  {!tpl.internal && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(tpl)}
                      className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                      title="Hapus Template"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Dialog Konfirmasi Hapus */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className={T.dialog}>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Hapus Template Email?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 dark:text-slate-400">
              Template <span className="text-slate-900 dark:text-slate-100 font-semibold">{deleteTarget?.label}</span> akan dihapus dari pilihan dropdown.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={T.btnCancel}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className={T.btnDanger}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
