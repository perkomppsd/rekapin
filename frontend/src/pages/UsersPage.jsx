// Manajemen user (admin). Daftar role diambil dari /api/meta (STATUS_SETS["role"]).

import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useMeta } from "@/context/MetaContext";
import { Navigate } from "react-router-dom";
import { api, describeApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { UserPlus, Trash2, Users as UsersIcon } from "lucide-react";
import AdminPageShell from "@/components/AdminPageShell";
import { T, tone } from "@/config/theme";

// Keterangan tambahan untuk tiap role di dropdown.
const ROLE_LABELS = { recruiter: "Recruiter (PIC)", admin: "Admin" };
const ROLE_TONES = { admin: "indigo", recruiter: "sky" };
const EMPTY_FORM = { email: "", name: "", password: "", role: "recruiter" };

export default function UsersPage() {
  const { user } = useAuth();
  const meta = useMeta();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/users");
      setUsers(data);
    } catch (e) {
      toast.error(describeApiError(e, "Gagal memuat"));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (user === null) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Memuat...</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/dashboard" replace />;

  const roles = meta.statusesOf ? meta.statusesOf("role") : [];
  const roleOptions = roles.length ? roles : ["recruiter", "admin"];

  const create = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/users", form);
      toast.success(`Akun ${form.name} dibuat`);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      toast.error(describeApiError(err, "Gagal membuat user"));
    } finally { setSaving(false); }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      toast.success("User dihapus");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(describeApiError(e, "Gagal menghapus"));
    }
  };

  return (
    <AdminPageShell
      title="Manajemen User"
      badge="Admin Only"
      badgeIcon="ShieldCheck"
      description="Buat akun untuk PIC / Recruiter. Mereka hanya bisa lihat & ubah kandidat yang dibuat sendiri atau kandidat yang di-assign ke email mereka."
    >
      {/* Form tambah user */}
      <form onSubmit={create} className={`${T.panel} p-6 space-y-4`}>
        <div className="flex items-center gap-2 text-slate-200 font-medium">
          <UserPlus className="w-4 h-4 text-indigo-400" /> Tambah User
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label className={T.label}>Email</Label>
            <Input data-testid="input-user-email" type="email" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} className={T.input} />
          </div>
          <div>
            <Label className={T.label}>Nama</Label>
            <Input data-testid="input-user-name" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} className={T.input} />
          </div>
          <div>
            <Label className={T.label}>Password</Label>
            <Input data-testid="input-user-password" type="text" required minLength={6}
              value={form.password} placeholder="min. 6 karakter"
              onChange={(e) => setForm({ ...form, password: e.target.value })} className={T.input} />
          </div>
          <div>
            <Label className={T.label}>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger data-testid="select-user-role" className={T.input}><SelectValue /></SelectTrigger>
              <SelectContent className={T.selectContent}>
                {roleOptions.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r] || r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Button type="submit" disabled={saving} data-testid="btn-create-user" className={T.btnPrimary}>
            <UserPlus className="w-4 h-4 mr-2" /> {saving ? "Menyimpan..." : "Tambah User"}
          </Button>
        </div>
      </form>

      {/* Daftar user */}
      <div className={`${T.panelSubtle} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2 text-slate-200">
          <UsersIcon className="w-4 h-4 text-indigo-400" /> Daftar User
        </div>
        {loading ? (
          <div className="text-slate-400 text-sm text-center py-8">Memuat...</div>
        ) : users.length === 0 ? (
          <div className="text-slate-500 text-sm text-center py-12">Belum ada user.</div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-900/70">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className={T.th}>Nama</TableHead>
                <TableHead className={T.th}>Email</TableHead>
                <TableHead className={T.th}>Role</TableHead>
                <TableHead className={`${T.th} text-right`}>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} data-testid={`row-user-${u.id}`}
                  className="border-slate-800/70 hover:bg-slate-800/40">
                  <TableCell className="text-slate-100 font-medium">{u.name}</TableCell>
                  <TableCell className="text-slate-300">{u.email}</TableCell>
                  <TableCell>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${tone(ROLE_TONES[u.role] || "neutral", "pill")}`}>
                      {u.role}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {u.id === user.id ? (
                      <span className="text-slate-500 text-xs">akun saya</span>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(u)}
                        data-testid={`btn-delete-user-${u.id}`}
                        className="h-8 w-8 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className={T.dialog}>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Hapus user?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Akun <span className="text-slate-200 font-medium">{deleteTarget?.name}</span> akan dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={T.btnCancel}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className={T.btnDanger}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPageShell>
  );
}
