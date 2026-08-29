// Form tambah/edit kandidat.
//
// TIDAK ADA daftar field di file ini — semua digambar dari /api/meta
// (sumbernya backend/app/schema.py). Untuk menambah kolom: cukup tambah
// FieldSpec di schema.py. Penyesuaian tampilan ada di config/formFields.js.

import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useMeta } from "@/context/MetaContext";
import FieldInput from "@/components/FieldInput";
import {
  DERIVED_FIELDS, GROUP_WARNINGS, LINKED_FIELDS, FORM_LABEL_OVERRIDES, VISIBLE_WHEN,
} from "@/config/formFields";
import { T } from "@/config/theme";

const RATING_GROUP = "penilaian";

// Kelas grid ditulis lengkap (bukan disusun dari variabel) supaya terdeteksi Tailwind.
const GRID_COLS = { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3" };

function Section({ title, children, cols = 2 }) {
  return (
    <div>
      <div className={`${T.sectionLabel} mb-3`}>{title}</div>
      <div className={`grid grid-cols-1 ${GRID_COLS[cols] || GRID_COLS[2]} gap-4`}>{children}</div>
    </div>
  );
}

function Warning({ text }) {
  // Teks memakai **tebal** sederhana.
  const parts = String(text).split("**");
  return (
    <div className="md:col-span-2 flex items-start gap-2 p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200 text-sm">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <div>{parts.map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : p))}</div>
    </div>
  );
}

export default function CandidateForm({ open, onOpenChange, initial, onSubmit, customFields = [] }) {
  const meta = useMeta();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const defaults = useMemo(
    () => ({ ...meta.defaults(), custom_data: {} }),
    [meta],
  );

  useEffect(() => {
    if (!open) return;
    setForm(initial
      ? { ...defaults, ...initial, custom_data: initial.custom_data || {} }
      : defaults);
  }, [open, initial, defaults]);

  const update = (k, v) => setForm((f) => {
    const next = { ...f, [k]: v };
    // Field bertaut: memilih PIC sekaligus mengisi email PIC.
    const link = LINKED_FIELDS[k];
    if (link) {
      const sumber = (meta[link.from] || []).find((o) => o[link.match] === v);
      Object.entries(link.fills).forEach(([tujuan, prop]) => {
        next[tujuan] = sumber ? sumber[prop] : "";
      });
    }
    return next;
  });
  const updateCustom = (k, v) =>
    setForm((f) => ({ ...f, custom_data: { ...(f.custom_data || {}), [k]: v } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    // Field angka: string kosong dikirim sebagai null, bukan "".
    const payload = { ...form };
    meta.fields.filter((f) => f.type === "number").forEach((f) => {
      payload[f.key] = payload[f.key] === "" || payload[f.key] == null ? null : Number(payload[f.key]);
    });
    const ok = await onSubmit(payload);
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  const visibleFields = (groupKey) =>
    meta.fieldsInGroup(groupKey).filter((f) => {
      const rule = VISIBLE_WHEN[f.key];
      return rule ? rule(form) : true;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-3xl ${T.dialog} max-h-[90vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {initial ? "Edit Kandidat" : "Tambah Kandidat"}
          </DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400">
            Isi data di sini. Perubahan status otomatis muncul di tab terkait & tercatat di riwayat.
          </DialogDescription>
        </DialogHeader>

        {meta.status === "error" ? (
          <div className="py-10 text-center space-y-3">
            <p className="text-slate-600 dark:text-slate-300 text-sm">Gagal memuat konfigurasi form.</p>
            <Button type="button" onClick={meta.reload} className={T.btnPrimary}>Coba lagi</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {meta.groups.map(({ key, label }) => {
              const fields = visibleFields(key);
              const warning = GROUP_WARNINGS[key]?.(form);
              if (!fields.length && !warning) return null;
              return (
                <Section key={key} title={label} cols={key === RATING_GROUP ? 3 : 2}>
                  {fields.map((f) => (
                    <FieldInput
                      key={f.key}
                      field={f}
                      label={FORM_LABEL_OVERRIDES[f.key]}
                      value={form[f.key]}
                      onChange={(v) => update(f.key, v)}
                      readOnly={Boolean(DERIVED_FIELDS[f.key])}
                    />
                  ))}
                  {warning ? <Warning text={warning} /> : null}
                </Section>
              );
            })}

            {customFields.length > 0 && (
              <Section title="Kolom Kustom">
                {customFields.map((f) => (
                  <FieldInput
                    key={f.id}
                    field={{ ...f, options: f.options || [], span: 1, required: false, hint: "" }}
                    value={form.custom_data?.[f.key]}
                    onChange={(v) => updateCustom(f.key, v)}
                    testid={`input-custom-${f.key}`}
                  />
                ))}
              </Section>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}
                className={T.btnGhostPlain} data-testid="btn-cancel-candidate">Batal</Button>
              <Button type="submit" disabled={saving} className={T.btnPrimary}
                data-testid="btn-save-candidate">
                {saving ? "Menyimpan..." : initial ? "Simpan Perubahan" : "Tambah Kandidat"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
