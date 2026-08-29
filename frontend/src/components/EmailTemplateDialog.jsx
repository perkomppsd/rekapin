// Dialog kirim email ke kandidat.
// Daftar template datang dari /api/meta (sumber: backend/app/emailing/templates.py),
// jadi menambah template baru tidak perlu mengubah file ini.

import React, { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { api, describeApiError } from "@/lib/api";
import { toast } from "sonner";
import { Send, Mail } from "lucide-react";
import { useMeta } from "@/context/MetaContext";
import { T } from "@/config/theme";

export default function EmailTemplateDialog({ open, onOpenChange, candidate }) {
  const { email_templates: templates = [] } = useMeta();
  const [tpl, setTpl] = useState("");
  const [sending, setSending] = useState(false);

  // Pilih template pertama begitu daftarnya tersedia.
  useEffect(() => {
    if (!tpl && templates.length) setTpl(templates[0].id);
  }, [templates, tpl]);

  const send = async () => {
    if (!candidate?.id || !tpl) return;
    if (!candidate.email) {
      toast.error("Email kandidat kosong. Edit dulu untuk isi email.");
      return;
    }
    setSending(true);
    try {
      await api.post(`/candidates/${candidate.id}/send-email`, { template: tpl });
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
      <DialogContent className={`sm:max-w-lg ${T.dialog}`}>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Kirim Email ke Kandidat
          </DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400">
            Kirim email ke <span className="text-slate-800 dark:text-slate-200 font-medium">{candidate?.nama}</span>
            {" "}({candidate?.email || <em className="text-rose-600 dark:text-rose-400">email kosong</em>}) menggunakan template siap pakai.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Label className={T.label}>Pilih Template</Label>
          <Select value={tpl} onValueChange={setTpl}>
            <SelectTrigger data-testid="select-email-template" className={T.input}>
              <SelectValue placeholder="Pilih template..." />
            </SelectTrigger>
            <SelectContent className={T.selectContent}>
              {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className={T.hint}>
            Template akan otomatis mengisi nama, posisi, tanggal, jam, dan metode dari data kandidat.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="btn-cancel-email"
            className={T.btnGhostPlain}>Batal</Button>
          <Button onClick={send} disabled={sending || !candidate?.email || !tpl}
            data-testid="btn-send-email" className={T.btnPrimary}>
            <Send className="w-4 h-4 mr-2" />
            {sending ? "Mengirim..." : "Kirim Email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
