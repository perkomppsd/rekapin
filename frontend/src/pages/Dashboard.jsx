// Dashboard utama.
//
// Tab, kartu statistik, dan funnel TIDAK di-hardcode di sini: daftarnya datang
// dari /api/meta (backend/app/schema.py). Filter per tab ada di
// config/tabPredicates.js, kolom tabel di config/tableViews.js.

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
import FunnelChart from "@/components/FunnelChart";
import { filterByTab } from "@/config/tabPredicates";
import { iconFor } from "@/config/icons";
import { T, tone } from "@/config/theme";

// Dipakai kalau /api/meta belum termuat.
const DEFAULT_SEARCH_FIELDS = ["nama", "nik", "email", "no_hp", "apply", "pic"];

// Laporkan hasil import: berapa masuk, berapa dilewati (NIK dobel / tidak valid).
function reportImport(data, verb) {
  const inserted = data.inserted ?? 0;
  const skipped = data.skipped ?? 0;
  if (inserted) toast.success(`${inserted} kandidat berhasil ${verb}`);
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
    <div className={`stat-card ${T.panel} p-5`} data-testid={testid}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-slate-500 text-[10px] tracking-[0.25em] uppercase">{label}</div>
          <div className="font-display text-3xl font-bold text-slate-50 mt-2">{value}</div>
        </div>
        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${tone(toneName, "card")}`}>
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
  const [customFields, setCustomFields] = useState([]);
  const [funnel, setFunnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [posFilter, setPosFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyCandidate, setHistoryCandidate] = useState(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailCandidate, setEmailCandidate] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const fileInputRef = useRef(null);
  const isAdmin = user?.role === "admin";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append("date_from", dateFrom);
      if (dateTo) params.append("date_to", dateTo);
      const [c, cf, fn] = await Promise.all([
        api.get(`/candidates${params.toString() ? "?" + params.toString() : ""}`),
        api.get("/custom-fields"),
        api.get("/candidates/funnel"),
      ]);
      setRows(c.data);
      setCustomFields(cf.data || []);
      setFunnel(fn.data.stages || []);
    } catch (e) {
      toast.error(describeApiError(e, "Gagal memuat data"));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const positions = useMemo(() => {
    const s = new Set();
    rows.forEach((r) => r.apply && s.add(r.apply));
    return Array.from(s);
  }, [rows]);

  const stats = useMemo(
    () => Object.fromEntries(tabs.map((t) => [t.key, filterByTab(rows, t.key).length])),
    [rows, tabs],
  );

  // Field yang ikut dicari: ditandai `searchable=True` di backend/app/schema.py.
  const searchFields = useMemo(
    () => (meta.searchable_fields?.length
      ? meta.searchable_fields
      : DEFAULT_SEARCH_FIELDS),
    [meta.searchable_fields],
  );

  const filtered = useMemo(() => {
    let list = filterByTab(rows, tab);
    if (q.trim()) {
      // Pencarian NIK dinormalisasi: user boleh ketik dengan spasi/titik.
      const needle = q.trim().toLowerCase();
      const digits = needle.replace(/\D/g, "");
      list = list.filter((r) =>
        searchFields.some((k) => {
          const value = (r[k] || "").toString().toLowerCase();
          if (!value) return false;
          return value.includes(needle) || (digits && value.includes(digits));
        }));
    }
    if (posFilter !== "all") list = list.filter((r) => r.apply === posFilter);
    return list;
  }, [rows, tab, q, posFilter, searchFields]);

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

  const exportExcel = async (scope) => {
    try {
      const res = await fetch(`${API}/candidates/export?scope=${scope}`, {
        headers: { Authorization: `Bearer ${tokenStore.get()}` },
      });
      if (!res.ok) throw new Error("Export gagal");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `recruitment_${scope}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("File Excel diunduh");
    } catch (e) {
      toast.error("Gagal export Excel");
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
              <Sparkles className="w-3 h-3 text-indigo-300" />
              <span className="text-indigo-200 text-[10px] tracking-[0.2em] uppercase">Master Data Otomatis</span>
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
            <Button onClick={() => fileInputRef.current?.click()} variant="outline"
              data-testid="btn-upload-xlsx" className={T.btnOutline}>
              <Upload className="w-4 h-4 mr-2" /> Upload .xlsx
            </Button>
            <Button onClick={() => setBulkOpen(true)} variant="outline" data-testid="btn-bulk-import"
              className={`rounded-full pill-btn ${tone("indigo", "button")}`}>
              <ClipboardPaste className="w-4 h-4 mr-2" /> Import Massal
            </Button>
            <Button onClick={() => exportExcel(tab)} variant="outline" data-testid="btn-export"
              className={T.btnOutline}>
              <Download className="w-4 h-4 mr-2" /> Export Excel
            </Button>
            {isAdmin && (
              <Button onClick={runTrainingReminder} variant="outline" data-testid="btn-run-reminder"
                className={`rounded-full pill-btn ${tone("amber", "button")}`}>
                <Bell className="w-4 h-4 mr-2" /> Kirim Reminder
              </Button>
            )}
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}
              data-testid="btn-add-candidate" className={T.btnPrimary}>
              <Plus className="w-4 h-4 mr-2" /> Tambah Kandidat
            </Button>
          </div>
        </div>

        {/* Kartu statistik — satu per tab */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {tabs.filter((t) => t.stat !== false).map((t) => (
            <StatCard
              key={t.key}
              icon={iconFor(t.icon)}
              label={t.stat_label || t.label}
              value={stats[t.key] ?? 0}
              toneName={t.tone}
              testid={t.key === "master" ? "stat-total" : `stat-${t.key}`}
            />
          ))}
        </div>

        <FunnelChart stages={funnel} />

        {/* Filter & tabel */}
        <div className="space-y-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="h-auto bg-slate-900/60 border border-slate-800 p-1 rounded-full flex flex-wrap gap-1">
              {tabs.map((t) => {
                const Icon = iconFor(t.icon);
                return (
                  <TabsTrigger key={t.key} value={t.key} data-testid={`tab-${t.key}`}
                    className="rounded-full data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-slate-400 px-4 py-2 text-sm gap-2">
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
                  value={q} onChange={(e) => setQ(e.target.value)}
                  className={`pl-9 ${T.inputLight}`} />
              </div>
              <Select value={posFilter} onValueChange={setPosFilter}>
                <SelectTrigger className="bg-slate-900 border-slate-800 text-slate-50" data-testid="filter-position">
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
                    className="text-slate-400 hover:text-slate-50 hover:bg-slate-800 h-9 w-9 shrink-0">
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
                  <div className="border border-slate-800 rounded-xl py-16 text-center text-slate-400">
                    Memuat data...
                  </div>
                ) : (
                  <CandidateTable
                    rows={filtered}
                    view={t.key}
                    onEdit={(r) => { setEditing(r); setFormOpen(true); }}
                    onDelete={(r) => setDeleteTarget(r)}
                    onBlacklist={handleBlacklist}
                    onShowHistory={handleShowHistory}
                    onSendEmail={handleSendEmail}
                  />
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className={T.dialog}>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Hapus kandidat?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Data <span className="text-slate-200 font-medium">{deleteTarget?.nama}</span> akan dihapus permanen.
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
