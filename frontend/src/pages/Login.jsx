import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import GoogleLoginButton from "@/components/GoogleLoginButton";
import { useTheme } from "@/context/ThemeContext";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  // Cara login ditentukan server (/auth/config), bukan ditebak frontend.
  const { gelap } = useTheme();
  const { user, login, error, loginWithGoogle, authConfig } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user && user !== false) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (e) => {
    e?.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const ok = await login(email, password);
      if (ok) {
        toast.success("Selamat datang!");
      } else {
        toast.error("Email atau password salah");
      }
    } catch (err) {
      toast.error(describeApiError(err, "Login gagal"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-5 bg-white dark:bg-slate-950 noise-bg">
      {/* Left panel */}
      <div className="hidden lg:flex lg:col-span-3 relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1515703944563-dbcfbf121b3d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjh8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBvZmZpY2UlMjBidWlsZGluZyUyMGFyY2hpdGVjdHVyZSUyMGRhcmt8ZW58MHx8fHwxNzg2ODg1MzM3fDA&ixlib=rb-4.1.0&q=85')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/95 via-slate-950/70 to-indigo-950/60" />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-white font-display font-bold text-lg">Rekapin</div>
              <div className="text-indigo-200/80 text-xs tracking-[0.2em] uppercase">HR Recruitment</div>
            </div>
          </div>

          <div className="space-y-6 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-400/40 bg-indigo-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-indigo-200 text-xs tracking-[0.2em] uppercase font-semibold">Master Data Terpusat</span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.05]">
              Rekap kandidat, <span className="text-indigo-400">otomatis rapi</span> di semua sheet.
            </h1>
            <p className="text-slate-200 text-base max-w-lg leading-relaxed">
              Cukup input di Master Data — Interview, Training, Blacklist, dan Placement
              terisi otomatis. Fokus pada people, bukan spreadsheet.
            </p>
          </div>

          <div className="text-slate-400 text-xs">© {new Date().getFullYear()} Rekapin — Built for HR teams</div>
        </div>
      </div>

      {/* Right panel */}
      <div className="lg:col-span-2 flex items-center justify-center p-6 sm:p-10 relative">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-md space-y-6 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 backdrop-blur-xl"
        >
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs tracking-[0.2em] uppercase">
              <ShieldCheck className="w-3.5 h-3.5" /> Login
            </div>
            <h2 className="font-display text-3xl font-bold text-slate-900 dark:text-slate-50">Masuk ke Rekapin</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Gunakan akun HR Anda untuk melanjutkan.</p>
          </div>

          {authConfig.google_aktif && (
            <div className="space-y-3">
              <GoogleLoginButton
                clientId={authConfig.google_client_id}
                gelap={gelap}
                onCredential={async (kredensial) => {
                  setSubmitting(true);
                  await loginWithGoogle(kredensial);
                  setSubmitting(false);
                }}
              />
              {authConfig.password_aktif && (
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                  <span className="text-slate-500 text-xs">atau</span>
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                </div>
              )}
            </div>
          )}

          {authConfig.password_aktif !== false && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-600 dark:text-slate-300 text-xs tracking-[0.15em] uppercase">Email</Label>
              <Input
                id="email"
                data-testid="login-email-input"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onSubmit(e);
                  }
                }}
                className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-50 h-11 focus:border-indigo-500 focus-visible:ring-indigo-500/40"
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-600 dark:text-slate-300 text-xs tracking-[0.15em] uppercase">Password</Label>
              <Input
                id="password"
                data-testid="login-password-input"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onSubmit(e);
                  }
                }}
                className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-50 h-11 focus:border-indigo-500 focus-visible:ring-indigo-500/40"
                placeholder="••••••••"
              />
            </div>
          </div>
          )}

          {error ? (
            <div className="text-rose-600 dark:text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-md px-3 py-2">
              {error}
            </div>
          ) : null}

          <Button
            type="submit"
            data-testid="login-submit-button"
            disabled={submitting}
            className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-full pill-btn group"
          >
            {submitting ? "Memproses..." : (
              <span className="inline-flex items-center gap-2">
                Masuk
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </span>
            )}
          </Button>

          <div className="text-center text-xs text-slate-500">
            Aman & terenkripsi · JWT + bcrypt
          </div>

          <div className="text-center text-xs text-slate-500">
            Mencari lowongan?{" "}
            <Link to="/lowongan" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
              data-testid="link-portal-karier">
              Lihat portal karier
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
