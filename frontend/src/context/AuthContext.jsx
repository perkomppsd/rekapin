import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, tokenStore, describeApiError } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=checking, false=guest, object=user
  const [error, setError] = useState("");
  // Cara login yang tersedia (dari server) — frontend tidak boleh menebak.
  const [authConfig, setAuthConfig] = useState({
    google_aktif: false, password_aktif: false, google_client_id: "",
  });

  useEffect(() => {
    api.get("/auth/config")
      .then(({ data }) => setAuthConfig(data))
      .catch(() => setAuthConfig(
        { google_aktif: false, password_aktif: true, google_client_id: "" }));
  }, []);

  const bootstrap = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      tokenStore.clear();
      setUser(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = async (email, password) => {
    setError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      tokenStore.set(data.access_token);
      setUser(data.user);
      return true;
    } catch (e) {
      setError(describeApiError(e, "Gagal masuk. Coba lagi."));
      return false;
    }
  };

  const loginWithGoogle = async (credential) => {
    setError("");
    try {
      const { data } = await api.post("/auth/google", { credential });
      tokenStore.set(data.access_token);
      setUser(data.user);
      return true;
    } catch (e) {
      setError(describeApiError(e, "Gagal masuk dengan Google."));
      return false;
    }
  };

  const logout = () => {
    tokenStore.clear();
    setUser(false);
  };

  return (
    <AuthContext.Provider
      value={{ user, login, loginWithGoogle, logout, error, setError, authConfig }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
