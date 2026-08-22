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
import { FORM, T } from "@/config/theme";
import { testIdFor } from "@/config/formFields";

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
          {(field.options || []).map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
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

export default function FieldInput({ field, label, value, onChange, testid }) {
  const Renderer = RENDERERS[field.type] || DefaultInput;
  const id = testid || testIdFor(field);
  return (
    <div className={`space-y-1.5 ${field.span === 2 ? "md:col-span-2" : ""}`}>
      <Label className={T.label}>{label || field.label}</Label>
      <Renderer field={field} value={value} onChange={onChange} testid={id} />
      {field.hint ? <p className={T.hint}>{field.hint}</p> : null}
    </div>
  );
}
