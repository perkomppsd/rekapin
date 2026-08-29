import "@/App.css";
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { MetaProvider } from "@/context/MetaContext";
import { Toaster } from "sonner";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import UsersPage from "@/pages/UsersPage";
import SettingsPage from "@/pages/SettingsPage";
import JobsPage from "@/pages/JobsPage";
import ApplicationsPage from "@/pages/ApplicationsPage";
import PortalLowongan from "@/pages/PortalLowongan";
import PortalLamaran from "@/pages/PortalLamaran";
import { T } from "@/config/theme";

// Daftar halaman. Tambah halaman baru = tambah satu entri
// (menu header-nya diatur di src/config/navigation.js).
const ROUTES = [
  { path: "/dashboard", element: <Dashboard />, protected: true },
  { path: "/users", element: <UsersPage />, protected: true },
  { path: "/settings", element: <SettingsPage />, protected: true },
  { path: "/kelola-lowongan", element: <JobsPage />, protected: true },
  { path: "/lamaran", element: <ApplicationsPage />, protected: true },
  // Portal karier: sengaja TANPA proteksi, ini halaman untuk pelamar umum.
  { path: "/lowongan", element: <PortalLowongan />, protected: false },
  { path: "/lowongan/:slug", element: <PortalLamaran />, protected: false },
];

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (user === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Memuat sesi...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <MetaProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              {ROUTES.map((r) => (
                <Route
                  key={r.path}
                  path={r.path}
                  element={r.protected ? <ProtectedRoute>{r.element}</ProtectedRoute> : r.element}
                />
              ))}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster
            position="top-right"
            theme="dark"
            toastOptions={{
              classNames: { toast: T.toast },
            }}
          />
        </MetaProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
