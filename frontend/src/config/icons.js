// Peta nama ikon (dikirim backend di /api/meta) -> komponen lucide.
// Tambah ikon baru: import di sini lalu daftarkan di ICONS.

import {
  Ban, BarChart3, Bell, Briefcase, ClipboardList, ClipboardPaste, Download,
  FileSignature, GraduationCap, Handshake, Inbox, MapPin, Plus, Settings,
  ShieldCheck, Sparkles, Upload, Users,
} from "lucide-react";

export const ICONS = {
  Ban, BarChart3, Bell, Briefcase, ClipboardList, ClipboardPaste, Download,
  FileSignature, GraduationCap, Handshake, Inbox, MapPin, Plus, Settings,
  ShieldCheck, Sparkles, Upload, Users,
};

export const iconFor = (name) => ICONS[name] || ClipboardList;
