// Dashboard utama.
//
// Tab, kartu statistik, dan funnel TIDAK di-hardcode di sini: daftarnya datang
// dari /api/meta (backend/app/schema.py). Kolom tabel diatur di
// config/tableViews.js.
//
// Semua penyaringan (tab, pencarian, posisi, tanggal) dan paginasi dikerjakan
// SERVER — lihat backend/app/services/listing.py. Browser tidak lagi menarik
// seluruh koleksi kandidat.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useMeta } from "@/context/MetaContext";
import { api, tokenStore, describeApiError, API } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Search, Plus, Download, Sparkles, ClipboardPaste, Upload, Bell, BarChart3, X,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import CandidateForm from "@/components/CandidateForm";
import CandidateTable from "@/components/CandidateTable";
import BulkImportDialog from "@/components/BulkImportDialog";
import HistoryDialog from "@/components/HistoryDialog";
import EmailTemplateDialog from "@/components/EmailTemplateDialog";
import ReminderDialog from "@/components/ReminderDialog";
import { ExportDialog } from "@/components/ExportDialog";
import FunnelChart from "@/components/FunnelChart";
import { iconFor } from "@/config/icons";
import Pagination from "@/components/Pagination";
import { T, tone } from "@/config/theme";

const PER_PAGE = 50;
const DEFAULT_SORT = { key: "created_at", order: "desc" };
const SEARCH_DEBOUNCE_MS = 350;

// Laporkan hasil import: berapa masuk, berapa dilewati (NIK dobel / tidak valid).
function reportImport(data, verb) {
  const inserted = data.inserted ?? 0;
  const skipped = data.skipped ?? 0;
  const autoNik = data.auto_nik ?? 0;
  if (inserted) toast.success(`${inserted} kandidat berhasil ${verb}`);
  const autoPic = data.auto_pic ?? 0;
  if (autoPic) {
    toast.info(`${autoPic} kandidat dapat email PIC otomatis`,
      { description: "Nama PIC dicocokkan dengan akun user yang ada." });
  }
  if (autoNik) {
    toast.info(`${autoNik} kandidat diberi NIK sementara`, {
      description: "Baris tanpa NIK diberi nomor sementara. Ganti kalau KTP sudah terkumpul.",
      duration: 8000,
    });
  }
  if (!skipped) {
    if (!inserted) toast.info("Tidak ada kandidat baru yang masuk.");
    return;
  }
  const detail = (data.duplicates || [])
    .slice(0, 5)
    .map((d) => `• ${d.nama || d.nik || "(tanpa nama)"} — ${d.alasan}`)
    .join("\n");
  const sisa = skipped > 5 ? `\n…dan ${skipped - 5} baris lainnya` : "";
  toast.warning(`${skipped} baris dilewati`, {
    description: detail + sisa,
    duration: 10000,
  });
}

function StatCard({ icon: Icon, label, value, toneName = "indigo", testid }) {
  return (
    <div className={`stat-card ${T.panel} p-4`} data-testid={testid}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-slate-500 text-[10px] tracking-[0.2em] uppercase truncate"
            title={label}>{label}</div>
          <div className="font-display text-2xl font-bold text-slate-900 dark:text-slate-50 mt-1">{value}</div>
        </div>
        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${tone(toneName, "card")}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const meta = useMeta();
  const tabs = meta.tabs;

  const [tab, setTab] = useState("master");
  const [rows, setRows] = useState([]);
  const [pageInfo, setPageInfo] = useState({ total: 0, page: 1, pages: 1, per_page: PER_PAGE });
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [stats, setStats] = useState({});
  const [positions, setPositions] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [funnel, setFunnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [qLive, setQLive] = useState("");   // isi kotak pencarian sebelum debounce
  const [posFilter, setPosFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyCandidate, setHistoryCandidate] = useState(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailCandidate, setEmailCandidate] = useState(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const fileInputRef = useRef(null);
  const isAdmin = user?.role === "admin";

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = (allIdsOnPage) => {
    const allSelected = allIdsOnPage.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !allIdsOnPage.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...allIdsOnPage])));
    }
  };

  // Parameter filter yang dikirim ke server (dipakai listing & export).
  const filterParams = useMemo(() => {
    const p = { scope: tab };
    if (q.trim()) p.q = q.trim();
    if (posFilter !== "all") p.position = posFilter;
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    return p;
  }, [tab, q, posFilter, dateFrom, dateTo]);

  // Debounce kotak pencarian supaya tidak memanggil server tiap ketikan.
  useEffect(() => {
    const t = setTimeout(() => setQ(qLive), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [qLive]);

  // Kembali ke halaman 1 setiap filter atau urutan berubah.
  useEffect(() => { setPage(1); }, [tab, q, posFilter, dateFrom, dateTo, sort]);

  // Klik judul kolom: kolom baru -> mulai dari turun; kolom sama -> balik arah.
  const handleSort = (key) => {
    setSort((s) => (s.key === key
      ? { key, order: s.order === "desc" ? "asc" : "desc" }
      : { key, order: "desc" }));
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const listParams = {
        ...filterParams, page, per_page: PER_PAGE,
        sort: sort.key, order: sort.order,
      };
      const [list, st, fn, pos, cf] = await Promise.all([
        api.get("/candidates", { params: listParams }),
        api.get("/candidates/stats"),
        api.get("/candidates/funnel"),
        api.get("/candidates/positions"),
        api.get("/custom-fields"),
      ]);
      const { items, ...meta } = list.data;
      setRows(items || []);
      setPageInfo(meta);
      setStats(st.data || {});
      setFunnel(fn.data.stages || []);
      setPositions(pos.data || []);
      setCustomFields(cf.data || []);
    } catch (e) {
      toast.error(describeApiError(e, "Gagal memuat data"));
    } finally {
      setLoading(false);
    }
  }, [filterParams, page, sort]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (payload) => {
    try {
      if (editing) {
        await api.put(`/candidates/${editing.id}`, payload);
        toast.success("Data diperbarui");
      } else {
        await api.post("/candidates", payload);
        toast.success("Kandidat ditambahkan");
      }
      await load();
      return true;
    } catch (e) {
      toast.error(describeApiError(e, "Gagal menyimpan"));
      return false;
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/candidates/${deleteTarget.id}`);
      toast.success("Kandidat dihapus");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(describeApiError(e, "Gagal menghapus"));
    }
  };

  const handleBlacklist = async (row) => {
    const reason = window.prompt(`Alasan blacklist untuk ${row.nama}:`, "Mengundurkan Diri");
    if (reason === null) return;
    try {
      await api.put(`/candidates/${row.id}`, {
        status_blacklist: reason.toLowerCase().includes("undur")
          ? "Ya - Mengundurkan Diri"
          : "Ya - Lainnya",
        alasan_blacklist: reason,
      });
      toast.success(`${row.nama} dimasukkan ke Blacklist`);
      await load();
    } catch (e) {
      toast.error(describeApiError(e, "Gagal memperbarui"));
    }
  };

  const handleShowHistory = (row) => {
    setHistoryCandidate(row);
    setHistoryOpen(true);
  };

  const handleSendEmail = (row) => {
    setEmailCandidate(row);
    setEmailOpen(true);
  };

  const handleBulkImport = async (items) => {
    try {
      const { data } = await api.post("/candidates/bulk", { items });
      reportImport(data, "diimport");
      await load();
      return true;
    } catch (e) {
      toast.error(describeApiError(e, "Gagal import massal"));
      return false;
    }
  };

  const handleUploadExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${API}/candidates/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenStore.get()}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload gagal");
      reportImport(data, "diupload");
      await load();
    } catch (err) {
      toast.error(err.message || "Gagal upload Excel");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const runTrainingReminder = async () => {
    try {
      await api.post("/candidates/training-reminder/run");
      toast.success("Reminder training dijalankan. Cek inbox email.");
    } catch (e) {
      toast.error(describeApiError(e, "Gagal menjalankan reminder"));
    }
  };

  const handleExportWithOptions = async ({ preset, format, useSelectedOnly }) => {
    try {
      const p = { ...filterParams, preset, format };
      if (useSelectedOnly && selectedIds.length > 0) {
        p.ids = selectedIds.join(",");
      }
      const query = new URLSearchParams(p).toString();
      const res = await fetch(`${API}/candidates/export?${query}`, {
        headers: { Authorization: `Bearer ${tokenStore.get()}` },
      });
      if (!res.ok) throw new Error("Export gagal");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = format === "csv" ? "csv" : "xlsx";
      a.download = `recruitment_${tab}_${preset}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`File ${ext.toUpperCase()} diunduh`);
    } catch (e) {
      toast.error("Gagal export data");
    }
  };

  const handleDownloadImportTemplate = async () => {
    try {
      const res = await fetch(`${API}/candidates/import-template`, {
        headers: { Authorization: `Bearer ${tokenStore.get()}` },
      });
      if (!res.ok) throw new Error("Gagal mengunduh template");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "template_import_kandidat_rekapin.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Template Excel import diunduh");
    } catch (e) {
      toast.error("Gagal mengunduh template import");
    }
  };

  const dateInputCls = `${T.inputLight} [color-scheme:dark]`;

  return (
    <div className={T.page}>
      <AppHeader />

      <main className={`${T.container} py-8 space-y-8`}>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 mb-3">
              <Sparkles className="w-3 h-3 text-indigo-700 dark:text-indigo-300" />
              <span className="text-indigo-700 dark:text-indigo-200 text-[10px] tracking-[0.2em] uppercase">Master Data Otomatis</span>
            </div>
            <h1 className={T.title}>Dashboard Recruitment</h1>
            <p className={T.subtitle}>
              Input di Master Data — Interview, Training, Blacklist, Placement mengikuti otomatis.
              Kirim email langsung ke kandidat.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input ref={fileInputRef} type="file" accept=".xlsx,.xlsm" onChange={handleUploadExcel}
              className="hidden" data-testid="input-upload-xlsx" />
            <Button onClick={handleDownloadImportTemplate} variant="outline"
              data-testid="btn-download-template" className={T.btnOutline} title="Unduh format file Excel resmi untuk impor massal">
              <Download className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" /> Template .xlsx
            </Button>
            <Button onClick={() => fileInputRef.current?.click()} variant="outline"
              data-testid="btn-upload-xlsx" className={T.btnOutline}>
              <Upload className="w-4 h-4 mr-2" /> Upload .xlsx
            </Button>
            <Button onClick={() => setBulkOpen(true)} variant="outline" data-testid="btn-bulk-import"
              className={`rounded-full pill-btn ${tone("indigo", "button")}`}>
              <ClipboardPaste className="w-4 h-4 mr-2" /> Import Massal
            </Button>
            <Button onClick={() => setExportOpen(true)} variant="outline" data-testid="btn-export"
              className={`${T.btnOutline} relative`}>
              <Download className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
              Export Data
              {selectedIds.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-600 text-white font-bold">
                  {selectedIds.length}
                </span>
              )}
            </Button>
            {isAdmin && (
              <Button
                onClick={() => setReminderOpen(true)}
                disabled={selectedIds.length === 0}
                variant="outline"
                data-testid="btn-run-reminder"
                title={selectedIds.length === 0 ? "Centang kandidat terlebih dahulu untuk mengirim reminder" : "Kirim reminder ke kandidat terpilih"}
                className={`rounded-full pill-btn ${tone("amber", "button")} ${selectedIds.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <Bell className="w-4 h-4 mr-2" /> Kirim Reminder
                {selectedIds.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-600 text-white font-bold">
                    {selectedIds.length}
                  </span>
                )}
              </Button>
            )}
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}
              data-testid="btn-add-candidate" className={T.btnPrimary}>
              <Plus className="w-4 h-4 mr-2" /> Tambah Kandidat
            </Button>
          </div>
        </div>

        {/* Ringkasan: kartu statistik di kiri, funnel di kanan supaya tidak
            memakan tinggi halaman. Di layar kecil keduanya bertumpuk. */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-start">
          <div className="xl:col-span-2 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-2 gap-3">
            {tabs.filter((t) => t.stat !== false).map((t) => (
              <StatCard
                key={t.key}
                icon={iconFor(t.icon)}
                label={t.stat_label || t.label}
                value={(t.key === "master" ? stats.total : stats[t.key]) ?? 0}
                toneName={t.tone}
                testid={t.key === "master" ? "stat-total" : `stat-${t.key}`}
              />
            ))}
          </div>
          <div className="xl:col-span-3">
            <FunnelChart stages={funnel} />
          </div>
        </div>

        {/* Filter & tabel */}
        <div className="space-y-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="h-auto bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-1 rounded-full flex flex-wrap gap-1">
              {tabs.map((t) => {
                const Icon = iconFor(t.icon);
                return (
                  <TabsTrigger key={t.key} value={t.key} data-testid={`tab-${t.key}`}
                    className="rounded-full data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-slate-500 dark:text-slate-400 px-4 py-2 text-sm gap-2">
                    <Icon className="w-3.5 h-3.5" />
                    {t.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
              <div className="relative md:col-span-2">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input data-testid="search-input"
                  placeholder="Cari nama, NIK, email, no HP, posisi, PIC..."
                  value={qLive} onChange={(e) => setQLive(e.target.value)}
                  className={`pl-9 ${T.inputLight}`} />
              </div>
              <Select value={posFilter} onValueChange={setPosFilter}>
                <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-50" data-testid="filter-position">
                  <SelectValue placeholder="Filter posisi apply" />
                </SelectTrigger>
                <SelectContent className={T.selectContent}>
                  <SelectItem value="all">Semua posisi</SelectItem>
                  {positions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Input data-testid="input-date-from" type="date" value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)} className={dateInputCls} />
                </div>
                <div className="flex-1">
                  <Input data-testid="input-date-to" type="date" value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)} className={dateInputCls} />
                </div>
                {(dateFrom || dateTo) && (
                  <Button type="button" size="icon" variant="ghost"
                    onClick={() => { setDateFrom(""); setDateTo(""); }}
                    data-testid="btn-clear-date"
                    className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-slate-800 h-9 w-9 shrink-0">
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
            <p className={T.hint}>
              <BarChart3 className="w-3 h-3 inline mr-1 -mt-0.5" />
              Filter tanggal input membantu memisahkan data yang di-input per hari oleh tim recruiter.
            </p>

            {tabs.map((t) => (
              <TabsContent key={t.key} value={t.key} className="mt-4">
                {loading ? (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl py-16 text-center text-slate-500 dark:text-slate-400">
                    Memuat data...
                  </div>
                ) : (
                  <CandidateTable
                    rows={rows}
                    view={t.key}
                    onEdit={(r) => { setEditing(r); setFormOpen(true); }}
                    onDelete={(r) => setDeleteTarget(r)}
                    onBlacklist={handleBlacklist}
                    onShowHistory={handleShowHistory}
                    onSendEmail={handleSendEmail}
                    sort={sort}
                    onSort={handleSort}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                    onToggleSelectAll={handleToggleSelectAll}
                  />
                )}
                {!loading && (
                  <Pagination info={pageInfo} onChange={setPage} disabled={loading} />
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </main>

      <CandidateForm open={formOpen} onOpenChange={setFormOpen} initial={editing}
        onSubmit={handleSubmit} customFields={customFields} />
      <BulkImportDialog open={bulkOpen} onOpenChange={setBulkOpen} onImport={handleBulkImport} />
      <HistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} candidate={historyCandidate} />
      <EmailTemplateDialog open={emailOpen} onOpenChange={setEmailOpen} candidate={emailCandidate} />
      <ReminderDialog open={reminderOpen} onOpenChange={setReminderOpen} selectedIds={selectedIds} />
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        onExport={handleExportWithOptions}
        totalFiltered={pageInfo.total}
        selectedCount={selectedIds.length}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className={T.dialog}>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Hapus kandidat?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 dark:text-slate-400">
              Data <span className="text-slate-800 dark:text-slate-200 font-medium">{deleteTarget?.nama}</span> akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-cancel-delete" className={T.btnCancel}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} data-testid="btn-confirm-delete" className={T.btnDanger}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
