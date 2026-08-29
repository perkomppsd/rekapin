// Satu input form generik. Bentuknya ditentukan `field.type` dari /api/meta.
// Tambah tipe input baru: tambah satu cabang di RENDERERS.

import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import StarRating from "@/components/StarRating";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { FORM, T } from "@/config/theme";
import { DYNAMIC_HINTS, FIELD_ACTIONS, testIdFor } from "@/config/formFields";

const NONE = "__none__";

const RENDERERS = {
  textarea: ({ field, value, onChange, testid }) => (
    <Textarea data-testid={testid} rows={2} value={value ?? ""}
      required={field.required} placeholder={field.placeholder}
      onChange={(e) => onChange(e.target.value)} className={FORM.input} />
  ),

  select: ({ field, value, onChange, testid }) => {
    // Field tanpa nilai default boleh dikosongkan lagi lewat pilihan "—".
    const clearable = !field.required && !field.default;
    const options = field.options || [];
    // Nilai lama yang sudah dihapus dari daftar tetap ditampilkan, supaya data
    // kandidat tidak diam-diam berubah saat form dibuka lalu disimpan.
    const orphan = value && !options.includes(value) ? value : null;
    return (
      <Select
        value={value || (clearable ? NONE : "")}
        onValueChange={(v) => onChange(v === NONE ? "" : v)}
      >
        <SelectTrigger data-testid={testid} className={FORM.select}>
          <SelectValue placeholder={field.placeholder || "Pilih..."} />
        </SelectTrigger>
        <SelectContent className={T.selectContent}>
          {clearable && <SelectItem value={NONE}>—</SelectItem>}
          {orphan && (
            <SelectItem value={orphan}>{orphan} (tidak ada di daftar)</SelectItem>
          )}
          {options.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
          {!options.length && !orphan && (
            <div className="px-2 py-3 text-xs text-slate-500 dark:text-slate-400">
              Daftar masih kosong — isi dulu di halaman Setting.
            </div>
          )}
        </SelectContent>
      </Select>
    );
  },

  rating: ({ value, onChange, testid }) => (
    <StarRating value={Number(value) || 0} onChange={onChange} testid={testid} size={22} />
  ),

  number: ({ field, value, onChange, testid }) => (
    <Input data-testid={testid} type="number" min="0" value={value ?? ""}
      required={field.required} placeholder={field.placeholder}
      onChange={(e) => onChange(e.target.value)} className={FORM.input} />
  ),

  date: ({ field, value, onChange, testid }) => (
    <Input data-testid={testid} type="date" value={value || ""}
      required={field.required}
      onChange={(e) => onChange(e.target.value)} className={FORM.date} />
  ),

  time: ({ field, value, onChange, testid }) => (
    <Input data-testid={testid} type="time" value={value || ""}
      required={field.required}
      onChange={(e) => onChange(e.target.value)} className={FORM.date} />
  ),
};

function DefaultInput({ field, value, onChange, testid }) {
  return (
    <Input data-testid={testid} type={field.type === "email" ? "email" : "text"}
      value={value ?? ""} required={field.required} placeholder={field.placeholder}
      onChange={(e) => onChange(e.target.value)} className={FORM.input} />
  );
}

function FieldAction({ action, fieldKey, onChange }) {
  const [busy, setBusy] = React.useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const { data } = await api.get(action.fetch);
      onChange(action.pick(data));
    } catch {
      toast.error("Gagal mengambil nilai otomatis. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button type="button" variant="outline" size="sm" onClick={run} disabled={busy}
      title={action.title} data-testid={`action-${fieldKey.replace(/_/g, "-")}`}
      className={`${T.btnOutline} shrink-0 whitespace-nowrap`}>
      {busy ? "..." : action.label}
    </Button>
  );
}

// Field yang nilainya berasal dari field lain: ditampilkan tapi tidak bisa
// diketik, supaya tidak bisa berbeda dari sumbernya.
function ReadOnlyValue({ value, testid, placeholder }) {
  return (
    <div data-testid={testid}
      className={`${FORM.input} h-10 flex items-center px-3 rounded-md text-sm opacity-70 select-all`}>
      {value || <span className="text-slate-500">{placeholder || "—"}</span>}
    </div>
  );
}

export default function FieldInput({ field, label, value, onChange, testid, readOnly = false }) {
  const Renderer = RENDERERS[field.type] || DefaultInput;
  const id = testid || testIdFor(field);
  const action = FIELD_ACTIONS[field.key];
  const showAction = !readOnly && action && !action.hideIf?.(value);
  const dynamicHint = DYNAMIC_HINTS[field.key]?.(value);
  return (
    <div className={`space-y-1.5 ${field.span === 2 ? "md:col-span-2" : ""}`}>
      <Label className={T.label}>
        {label || field.label}
        {field.required ? <span className="text-rose-600 dark:text-rose-400 ml-1">*</span> : null}
      </Label>
      <div className={showAction ? "flex items-center gap-2" : undefined}>
        <div className={showAction ? "flex-1 min-w-0" : undefined}>
          {readOnly
            ? <ReadOnlyValue value={value} testid={id} placeholder={field.placeholder} />
            : <Renderer field={field} value={value} onChange={onChange} testid={id} />}
        </div>
        {showAction && (
          <FieldAction action={action} fieldKey={field.key} onChange={onChange} />
        )}
      </div>
      {dynamicHint
        ? <p className="text-indigo-700 dark:text-indigo-300 text-xs" data-testid={`hint-${field.key}`}>{dynamicHint}</p>
        : field.hint ? <p className={T.hint}>{field.hint}</p> : null}
    </div>
  );
}
