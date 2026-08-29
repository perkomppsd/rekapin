// Halaman Setting (admin): data master aplikasi.
//
// 1. Daftar referensi (Unit Usaha, Jobdesk, ...) -> mengisi dropdown di form
//    kandidat. Definisinya di backend/app/schema.py -> REFERENCE_LISTS,
//    UI-nya digambar otomatis oleh ReferenceListManager.
// 2. Kolom kustom -> menambah kolom baru tanpa ubah kode.

import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";
import { api, describeApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Columns3 } from "lucide-react";
import AdminPageShell from "@/components/AdminPageShell";
import ReferenceListManager from "@/components/ReferenceListManager";
import { useMeta } from "@/context/MetaContext";
import { T } from "@/config/theme";

// Tipe kolom kustom yang didukung backend (app/routers/custom_fields.py).
const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "select", label: "Dropdown" },
];

const EMPTY_FORM = { label: "", type: "text", options: "" };

export default function SettingsPage() {
  const { user } = useAuth();
  const meta = useMeta();
  const [fields, setFields] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/custom-fields");
      setFields(data);
    } catch (e) {
      toast.error(describeApiError(e, "Gagal memuat"));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (user === null) {
    return <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center text-slate-500 dark:text-slate-400">Memuat...</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/dashboard" replace />;

  const create = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        label: form.label.trim(),
        type: form.type,
        options: form.type === "select"
          ? form.options.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
      };
      await api.post("/custom-fields", payload);
      toast.success(`Kolom "${payload.label}" dibuat`);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      toast.error(describeApiError(err, "Gagal membuat kolom"));
    } finally { setSaving(false); }
  };

  const doDelete = async (f) => {
    if (!window.confirm(`Hapus kolom "${f.label}"? Data yang sudah tersimpan tidak akan hilang tapi tidak muncul lagi di form.`)) return;
    try {
      await api.delete(`/custom-fields/${f.id}`);
      toast.success("Kolom dihapus");
      await load();
    } catch (e) {
      toast.error(describeApiError(e, "Gagal menghapus"));
    }
  };

  const referenceLists = meta.reference_lists || [];

  return (
    <AdminPageShell
      title="Setting — Data Master"
      badge="Data Master"
      badgeIcon="Settings"
      description="Kelola daftar pilihan yang muncul di form kandidat (Unit Usaha, Jobdesk) dan tambahkan kolom sesuai kebutuhan tim."
    >
      {referenceLists.map((list) => (
        <ReferenceListManager key={list.key} list={list} />
      ))}

      <div className="pt-2">
        <div className="text-slate-900 dark:text-slate-100 font-medium">Kolom Kustom</div>
        <div className={T.hint}>
          Untuk kebutuhan yang belum ada kolomnya (misal: Sumber Info, Skala Gaji).
          Kolom akan otomatis muncul di form kandidat.
        </div>
      </div>
      <form onSubmit={create} className={`${T.panel} p-6 space-y-4`}>
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-medium">
          <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Tambah Kolom Baru
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <Label className={T.label}>Label</Label>
            <Input data-testid="input-cf-label" required value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="cth. Sumber Info" className={T.input} />
          </div>
          <div>
            <Label className={T.label}>Tipe</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger data-testid="select-cf-type" className={T.input}><SelectValue /></SelectTrigger>
              <SelectContent className={T.selectContent}>
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className={T.label}>
              Opsi {form.type === "select" ? "(pisah koma)" : "(khusus dropdown)"}
            </Label>
            <Input data-testid="input-cf-options" value={form.options}
              onChange={(e) => setForm({ ...form, options: e.target.value })}
              disabled={form.type !== "select"} placeholder="A, B, C" className={T.input} />
          </div>
        </div>
        <div>
          <Button type="submit" disabled={saving} data-testid="btn-create-cf" className={T.btnPrimary}>
            <Plus className="w-4 h-4 mr-2" /> {saving ? "Menyimpan..." : "Tambah Kolom"}
          </Button>
        </div>
      </form>

      <div className={`${T.panelSubtle} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 text-slate-800 dark:text-slate-200">
          <Columns3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Kolom Aktif
        </div>
        {loading ? (
          <div className="text-slate-500 dark:text-slate-400 text-sm text-center py-8">Memuat...</div>
        ) : fields.length === 0 ? (
          <div className="text-slate-500 text-sm text-center py-12">
            Belum ada kolom kustom. Tambahkan lewat form di atas.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {fields.map((f) => (
              <li key={f.id} className="flex items-center justify-between px-4 py-3"
                data-testid={`row-cf-${f.id}`}>
                <div>
                  <div className="text-slate-900 dark:text-slate-100 font-medium">{f.label}</div>
                  <div className="text-slate-500 text-xs">
                    key: <span className="font-mono">{f.key}</span> · tipe: <span className="text-slate-600 dark:text-slate-300">{f.type}</span>
                    {f.type === "select" && f.options?.length ? <> · opsi: {f.options.join(", ")}</> : null}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => doDelete(f)}
                  data-testid={`btn-delete-cf-${f.id}`}
                  className="h-8 w-8 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-500/10">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminPageShell>
  );
}
