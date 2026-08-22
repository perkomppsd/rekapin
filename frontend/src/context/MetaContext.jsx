// Konfigurasi skema dari backend (GET /api/meta -> backend/app/schema.py).
//
// Berkat provider ini frontend TIDAK menyimpan salinan daftar field, status,
// tab, atau template email. Tambah kolom/status/tab di backend/app/schema.py,
// dan form, tabel, dropdown, serta filter di UI ikut berubah sendiri.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const MetaContext = createContext(null);

const EMPTY = {
  fields: [],
  groups: [],
  statuses: {},
  tabs: [{ key: "master", label: "Master Data", icon: "ClipboardList", tone: "indigo", stat: true }],
  funnel: [],
  email_templates: [],
  import_columns: [],
  system_fields: [],
  searchable_fields: [],
  nik_temp_prefix: "",
  reference_lists: [],
  user_options: [],
};

// Fallback label kalau meta belum termuat: "tanggal_mulai_training" -> "Tanggal Mulai Training"
const prettify = (key) =>
  String(key || "")
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

export function MetaProvider({ children }) {
  const { user } = useAuth();
  const [meta, setMeta] = useState(EMPTY);
  const [status, setStatus] = useState("loading"); // loading | ready | error

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const { data } = await api.get("/meta");
      setMeta({ ...EMPTY, ...data });
      setStatus("ready");
    } catch {
      setMeta(EMPTY);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // Skema bisa berubah di server (mis. ada kolom/tab baru) sementara tab browser
  // tetap terbuka. Segarkan begitu tab kembali aktif, supaya tidak perlu
  // reload manual setiap kali backend/app/schema.py diubah.
  useEffect(() => {
    if (!user) return undefined;
    const refresh = () => {
      if (!document.hidden) load();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [user, load]);

  const value = useMemo(() => {
    const fieldByKey = Object.fromEntries(meta.fields.map((f) => [f.key, f]));
    const systemByKey = Object.fromEntries((meta.system_fields || []).map((f) => [f.key, f]));
    return {
      status,
      reload: load,
      ...meta,
      fieldByKey,
      fieldsInGroup: (groupKey) => meta.fields.filter((f) => f.group === groupKey),
      labelOf: (key) =>
        fieldByKey[key]?.label || systemByKey[key]?.label || prettify(key),
      optionsOf: (key) => fieldByKey[key]?.options || [],
      statusesOf: (setName) => meta.statuses?.[setName] || [],
      defaults: () =>
        Object.fromEntries(
          meta.fields.map((f) => [f.key, f.default === null || f.default === undefined ? "" : f.default]),
        ),
    };
  }, [meta, status, load]);

  return <MetaContext.Provider value={value}>{children}</MetaContext.Provider>;
}

// Nilai darurat kalau provider belum terpasang — supaya komponen tidak crash.
const FALLBACK = {
  ...EMPTY,
  status: "loading",
  reload: () => {},
  fieldByKey: {},
  fieldsInGroup: () => [],
  labelOf: prettify,
  optionsOf: () => [],
  statusesOf: () => [],
  defaults: () => ({}),
};

export const useMeta = () => useContext(MetaContext) || FALLBACK;
