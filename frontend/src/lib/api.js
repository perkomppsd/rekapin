import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const TOKEN_KEY = "hr_recruit_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Ubah error axios apa pun jadi satu pesan yang bisa dibaca user.
// Pakai ini di semua catch block supaya pesan error konsisten di seluruh app.
// Poster lowongan boleh dilihat tanpa login (berkas lamaran TIDAK — itu lewat
// /berkas/{id} yang butuh token).
export const posterUrl = (poster) =>
  poster?.id ? `${API}/publik/poster/${poster.id}` : null;


export function describeApiError(error, fallback = "Terjadi kesalahan. Coba lagi.") {
  // Tidak ada response = request tidak sampai ke server (backend mati / CORS / offline).
  if (error && !error.response) {
    if (error.code === "ECONNABORTED" || /timeout/i.test(error.message || "")) {
      return "Server tidak merespons (timeout). Coba lagi sebentar.";
    }
    return `Tidak bisa menghubungi server di ${BACKEND_URL || "backend"}. Pastikan backend sudah berjalan.`;
  }
  if (error?.response?.status === 500) {
    return "Terjadi kesalahan di server. Cek log backend.";
  }
  return formatApiError(error?.response?.data?.detail) || fallback;
}

export function formatApiError(detail) {
  if (detail == null) return "Terjadi kesalahan. Coba lagi.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
