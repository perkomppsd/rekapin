import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, tokenStore, describeApiError } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=checking, false=guest, object=user
  const [error, setError] = useState("");

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

  const logout = () => {
    tokenStore.clear();
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, error, setError }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
