// Pengelola satu daftar referensi (Unit Usaha, Jobdesk, ...).
//
// Komponen ini generik: definisi daftarnya datang dari /api/meta
// (backend/app/schema.py -> REFERENCE_LISTS), jadi daftar baru langsung
// dapat UI-nya sendiri tanpa menambah kode di sini.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check, X, Search, ChevronLeft, ChevronRight, ChevronsUpDown, Eye } from "lucide-react";
import { api, describeApiError } from "@/lib/api";
import { useMeta } from "@/context/MetaContext";
import { T } from "@/config/theme";

export default function ReferenceListManager({ list }) {
  const meta = useMeta();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nama: "", keterangan: "" });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);      // { id, nama, keterangan }
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Filter & Paginasi
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // 10, 25, 50, "all"

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/references/${list.key}`);
      setItems(data || []);
    } catch (e) {
      toast.error(describeApiError(e, `Gagal memuat ${list.label}`));
    } finally { setLoading(false); }
  }, [list.key, list.label]);

  useEffect(() => { load(); }, [load]);

  // Reset ke halaman 1 jika kata kunci cari berubah
  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  // Dropdown di form kandidat ikut berubah, jadi skema perlu disegarkan.
  const refresh = async () => { await load(); meta.reload?.(); };

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase().strip ? search.toLowerCase().strip() : search.toLowerCase();
    return items.filter(
      (it) =>
        (it.nama && it.nama.toLowerCase().includes(q)) ||
        (it.keterangan && it.keterangan.toLowerCase().includes(q))
    );
  }, [items, search]);

  const totalItems = filteredItems.length;
  const isAll = pageSize === "all";
  const numPageSize = isAll ? totalItems || 1 : Number(pageSize);
  const totalPages = isAll ? 1 : Math.max(1, Math.ceil(totalItems / numPageSize));
  const currentPage = Math.min(page, totalPages);

  const startIndex = isAll ? 0 : (currentPage - 1) * numPageSize;
  const endIndex = isAll ? totalItems : Math.min(startIndex + numPageSize, totalItems);

  const displayedItems = useMemo(() => {
    if (isAll) return filteredItems;
    return filteredItems.slice(startIndex, endIndex);
  }, [filteredItems, isAll, startIndex, endIndex]);

  const create = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/references/${list.key}`, form);
      toast.success(`${list.singular} "${form.nama}" ditambahkan`);
      setForm({ nama: "", keterangan: "" });
      await refresh();
    } catch (err) {
      toast.error(describeApiError(err, `Gagal menambah ${list.singular.toLowerCase()}`));
    } finally { setSaving(false); }
  };

  const simpanEdit = async () => {
    if (savingEdit) return;                       // cegah dobel saat Enter ditekan cepat
    if (!editing.nama.trim()) {
      toast.error(`Nama ${list.singular.toLowerCase()} tidak boleh kosong`);
      return;
    }
    setSavingEdit(true);
    try {
      await api.put(`/references/${list.key}/${editing.id}`, {
        nama: editing.nama, keterangan: editing.keterangan,
      });
      toast.success("Perubahan disimpan");
      setEditing(null);
      await refresh();
    } catch (e) {
      toast.error(describeApiError(e, "Gagal menyimpan"));
    } finally {
      setSavingEdit(false);
    }
  };

  const editKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      simpanEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditing(null);
    }
  };

  const hapus = async () => {
    try {
      const { data } = await api.delete(`/references/${list.key}/${deleteTarget.id}`);
      toast.success(`"${deleteTarget.nama}" dihapus dari daftar`);
      if (data?.masih_dipakai) {
        toast.info(`Masih dipakai ${data.masih_dipakai} data kandidat`, {
          description: "Data kandidat tidak diubah — nilainya tetap tersimpan sebagai catatan.",
          duration: 8000,
        });
      }
      setDeleteTarget(null);
      await refresh();
    } catch (e) {
      toast.error(describeApiError(e, "Gagal menghapus"));
    }
  };

  return (
    <div className={`${T.panelSubtle} overflow-hidden`} data-testid={`ref-${list.key}`}>
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="text-slate-900 dark:text-slate-100 font-medium">{list.label} ({items.length})</div>
          <div className={T.hint}>{list.description}</div>
        </div>
      </div>

      <form onSubmit={create} className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className={T.label}>Nama {list.singular}</Label>
            <Input required value={form.nama} className={T.input}
              data-testid={`input-${list.key}-nama`}
              onChange={(e) => setForm({ ...form, nama: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label className={T.label}>{list.note_label}</Label>
            <Input value={form.keterangan} className={T.input}
              data-testid={`input-${list.key}-keterangan`}
              placeholder="opsional"
              onChange={(e) => setForm({ ...form, keterangan: e.target.value })} />
          </div>
        </div>
        <Button type="submit" disabled={saving} className={T.btnPrimary}
          data-testid={`btn-add-${list.key}`}>
          <Plus className="w-4 h-4 mr-2" /> {saving ? "Menyimpan..." : `Tambah ${list.singular}`}
        </Button>
      </form>

      {/* Bar Pencarian & Pilihan Per Halaman */}
      {items.length > 0 && (
        <div className="px-4 py-2.5 bg-slate-100/60 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Cari nama ${list.singular.toLowerCase()}...`}
              className="pl-9 h-8 text-xs bg-white dark:bg-slate-900"
            />
          </div>

          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <span>Tampilkan:</span>
            <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0.5">
              {[10, 25, 50, "all"].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPageSize(size)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    pageSize === size
                      ? "bg-indigo-600 text-white"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {size === "all" ? "Semua" : size}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-slate-500 dark:text-slate-400 text-sm text-center py-8">Memuat...</div>
      ) : items.length === 0 ? (
        <div className="text-slate-500 text-sm text-center py-10">
          Belum ada {list.singular.toLowerCase()}. Tambahkan lewat form di atas.
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-slate-500 text-sm text-center py-10">
          Tidak ada {list.singular.toLowerCase()} yang cocok dengan pencarian "{search}".
        </div>
      ) : (
        <>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {displayedItems.map((it) => (
              <li key={it.id} className="px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors" data-testid={`row-${list.key}-${it.id}`}>
                {editing?.id === it.id ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                    <Input autoFocus value={editing.nama} className={T.input}
                      data-testid={`edit-${list.key}-nama`}
                      placeholder={`Nama ${list.singular.toLowerCase()}`}
                      onKeyDown={editKeyDown}
                      onChange={(e) => setEditing({ ...editing, nama: e.target.value })} />
                    <Input value={editing.keterangan} className={T.input}
                      data-testid={`edit-${list.key}-keterangan`}
                      placeholder={list.note_label}
                      onKeyDown={editKeyDown}
                      onChange={(e) => setEditing({ ...editing, keterangan: e.target.value })} />
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={simpanEdit} disabled={savingEdit}
                        className={T.btnPrimary} data-testid={`btn-save-${list.key}`}>
                        <Check className="w-4 h-4 mr-1" /> {savingEdit ? "..." : "Simpan"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}
                        className={T.btnGhostPlain} title="Batal (Esc)">
                        <X className="w-4 h-4" />
                      </Button>
                      <span className={`${T.hint} hidden lg:inline`}>Enter simpan · Esc batal</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-slate-900 dark:text-slate-100 font-medium">{it.nama}</div>
                      {it.keterangan ? (
                        <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 whitespace-pre-wrap break-words">
                          {it.keterangan}
                        </div>
                      ) : null}
                      <div className={`${T.hint} mt-1`}>
                        {it.dipakai ? `dipakai ${it.dipakai} data kandidat` : "belum dipakai"}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon"
                        data-testid={`btn-edit-${list.key}-${it.id}`}
                        onClick={() => setEditing({
                          id: it.id, nama: it.nama, keterangan: it.keterangan || "",
                        })}
                        className="h-8 w-8 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon"
                        data-testid={`btn-delete-${list.key}-${it.id}`}
                        onClick={() => setDeleteTarget(it)}
                        className="h-8 w-8 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-500/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {/* Footer Paginasi & Lihat Selengkapnya */}
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Menampilkan <span className="font-semibold text-slate-800 dark:text-slate-200">{totalItems > 0 ? startIndex + 1 : 0}–{endIndex}</span> dari{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">{totalItems}</span> {list.label}
              {search && ` (dari total ${items.length})`}
            </div>

            {!isAll && totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 text-xs px-2.5 rounded-lg"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Prev
                </Button>

                <span className="text-xs text-slate-600 dark:text-slate-300 px-1 font-medium">
                  {currentPage} / {totalPages}
                </span>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 text-xs px-2.5 rounded-lg"
                >
                  Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>

                {currentPage < totalPages && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    className="h-8 text-xs px-3 rounded-full border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-500/20"
                  >
                    Lihat Selengkapnya ({totalItems - endIndex} lagi)
                  </Button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className={T.dialog}>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Hapus {list.singular.toLowerCase()}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 dark:text-slate-400">
              <span className="text-slate-800 dark:text-slate-200 font-medium">{deleteTarget?.nama}</span> akan
              hilang dari pilihan dropdown.
              {deleteTarget?.dipakai ? (
                <> Saat ini masih dipakai <span className="text-amber-700 dark:text-amber-300">
                  {deleteTarget.dipakai} data kandidat</span> — data itu tidak diubah,
                  nilainya tetap tersimpan sebagai catatan.</>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={T.btnCancel}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={hapus} className={T.btnDanger}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
