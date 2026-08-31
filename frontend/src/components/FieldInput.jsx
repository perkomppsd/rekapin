// Satu input form generik. Bentuknya ditentukan `field.type` dari /api/meta.
// Tambah tipe input baru: tambah satu cabang di RENDERERS.

import React from "react";
import { Search, X } from "lucide-react";
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

function SearchableSelect({ field, value, onChange, testid }) {
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const clearable = !field.required && !field.default;
  const options = React.useMemo(() => field.options || [], [field.options]);
  const orphan = value && !options.includes(value) ? value : null;

  const filteredOptions = React.useMemo(() => {
    if (!search.trim()) return options;
    const term = search.toLowerCase().trim();
    return options.filter((o) => String(o).toLowerCase().includes(term));
  }, [options, search]);

  return (
    <Select
      open={open}
      onOpenChange={(isOpened) => {
        setOpen(isOpened);
        if (!isOpened) setSearch("");
      }}
      value={value || (clearable ? NONE : "")}
      onValueChange={(v) => onChange(v === NONE ? "" : v)}
    >
      <SelectTrigger data-testid={testid} className={FORM.select}>
        <SelectValue placeholder={field.placeholder || "Pilih..."} />
      </SelectTrigger>
      <SelectContent className={`${T.selectContent} max-h-[320px] overflow-hidden flex flex-col p-0`}>
        {/* Input pencarian di bagian atas dropdown */}
        <div className="p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm sticky top-0 z-20">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder={`Cari ${field.label || "pilihan"}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
              }}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
            {search && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearch("");
                }}
                className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-y-auto p-1 max-h-[250px]">
          {clearable && !search && <SelectItem value={NONE}>—</SelectItem>}
          {orphan && (
            <SelectItem value={orphan}>{orphan} (tidak ada di daftar)</SelectItem>
          )}
          {filteredOptions.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
          {!filteredOptions.length && (
            <div className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
              {search ? `Tidak ada pilihan "${search}"` : "Daftar masih kosong — isi di Setting."}
            </div>
          )}
        </div>
      </SelectContent>
    </Select>
  );
}

const RENDERERS = {
  textarea: ({ field, value, onChange, testid }) => (
    <Textarea data-testid={testid} rows={2} value={value ?? ""}
      required={field.required} placeholder={field.placeholder}
      onChange={(e) => onChange(e.target.value)} className={FORM.input} />
  ),

  select: (props) => <SearchableSelect {...props} />,

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
