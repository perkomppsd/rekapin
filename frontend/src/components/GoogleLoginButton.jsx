// Tombol "Masuk dengan Google" (Google Identity Services).
//
// Script GSI dimuat saat komponen dipakai, bukan di index.html, supaya halaman
// portal publik tidak ikut memuat script pihak ketiga yang tidak dibutuhkan.

import React, { useEffect, useRef, useState } from "react";
import { T } from "@/config/theme";

const SRC = "https://accounts.google.com/gsi/client";

function muatScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  const adaTag = document.querySelector(`script[src="${SRC}"]`);
  return new Promise((resolve, reject) => {
    if (adaTag) {
      adaTag.addEventListener("load", resolve);
      adaTag.addEventListener("error", reject);
      return;
    }
    const tag = document.createElement("script");
    tag.src = SRC;
    tag.async = true;
    tag.defer = true;
    tag.onload = resolve;
    tag.onerror = () => reject(new Error("gagal memuat"));
    document.head.appendChild(tag);
  });
}

export default function GoogleLoginButton({ clientId, onCredential, gelap = true }) {
  const kotak = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!clientId) return;
    let batal = false;
    muatScript()
      .then(() => {
        if (batal || !kotak.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (res) => onCredential(res.credential),
        });
        window.google.accounts.id.renderButton(kotak.current, {
          theme: gelap ? "filled_black" : "outline",
          size: "large",
          shape: "pill",
          width: 320,
          text: "signin_with",
          locale: "id",
        });
      })
      .catch(() => !batal && setError(
        "Tidak bisa memuat layanan Google. Periksa koneksi internet."));
    return () => { batal = true; };
  }, [clientId, onCredential, gelap]);

  if (!clientId) {
    return (
      <div className="text-center text-xs text-amber-700 dark:text-amber-300 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
        Login Google belum dikonfigurasi (GOOGLE_CLIENT_ID kosong di server).
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div ref={kotak} className="flex justify-center" data-testid="google-login-button" />
      {error && <p className="text-center text-xs text-rose-700 dark:text-rose-300">{error}</p>}
    </div>
  );
}
