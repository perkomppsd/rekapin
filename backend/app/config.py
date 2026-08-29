"""Konfigurasi terpusat — SEMUA environment variable dibaca di sini.

Cara menambah setting baru:
  1. Tambah satu baris di bawah (beri komentar singkat).
  2. Pakai `config.NAMA_SETTING` di modul lain.

Aturan: modul lain TIDAK BOLEH memanggil os.environ langsung.
"""

import os
from pathlib import Path
from typing import Tuple

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")


# ---------- Wajib (app tidak boleh jalan tanpa ini) ----------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

# ---------- Auth ----------
JWT_ALGORITHM = "HS256"
TOKEN_TTL_HOURS = 12
MIN_PASSWORD_LENGTH = 8

# Paginasi listing kandidat
DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 200

# ---------- Aplikasi ----------
APP_TITLE = "HR Recruitment Master Data"
PUBLIC_APP_URL = os.environ.get("PUBLIC_APP_URL", "https://example.com")
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")

# ---------- Email ----------
# Endpoint provider email (POST JSON). Kosong = pengiriman email DINONAKTIFKAN,
# email hanya dicatat di log — aman untuk development.
# Contoh: https://api.provider-email.com/v1/email/send
EMAIL_API_URL = os.environ.get("EMAIL_API_URL", "")
EMAIL_API_KEY = os.environ.get("EMAIL_API_KEY", "")
# Nama header untuk API key (tiap provider beda: X-Email-Key, Authorization, dst).
EMAIL_API_KEY_HEADER = os.environ.get("EMAIL_API_KEY_HEADER", "X-Email-Key")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Rekapin HR")
EMAIL_TIMEOUT_SECONDS = 30


def email_enabled() -> bool:
    return bool(EMAIL_API_URL and EMAIL_API_KEY)

# Penerima notifikasi internal saat ada kandidat diterima.
HIRE_NOTIFY_EMAIL = os.environ.get("HASAN_EMAIL", "hasan@company.com").strip().lower()
HIRE_NOTIFY_NAME = os.environ.get("HASAN_NAME", "Hasan")

# ---------- Berkas lamaran ----------
# Disimpan di folder ini (bukan di dalam static) supaya TIDAK bisa diakses
# publik lewat URL — hanya lewat endpoint /api/berkas/{id} yang cek login.
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", BACKEND_DIR / "uploads"))
MAX_FILE_MB = int(os.environ.get("MAX_FILE_MB", "5"))
MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024

# Batas lamaran publik per IP (anti-spam sederhana).
PUBLIC_RATE_LIMIT = int(os.environ.get("PUBLIC_RATE_LIMIT", "5"))
PUBLIC_RATE_WINDOW_MINUTES = int(os.environ.get("PUBLIC_RATE_WINDOW_MINUTES", "60"))


# ---------- Aturan bisnis ----------
TRAINING_PERIOD_DAYS = 90          # masa training (3 bulan)
CONTRACT_PERIOD_DAYS = 180         # masa kontrak kerja (6 bulan)
REMINDER_DAYS = (7, 0)             # kirim reminder H-7 dan hari-H
TRAINING_REMINDER_DAYS = REMINDER_DAYS   # nama lama, masih dipakai sebagian kode
QUERY_LIMIT = 5000                 # batas dokumen untuk export & job batch

# Zona waktu kantor. Dipakai agar filter "tanggal input" mengikuti hari lokal,
# bukan hari UTC (WIB = 7, WITA = 8, WIT = 9).
LOCAL_UTC_OFFSET_HOURS = int(os.environ.get("LOCAL_UTC_OFFSET_HOURS", "7"))


# ---------- Secret & kredensial: dibaca lazy supaya bisa dirotasi ----------
def jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def cron_secret() -> str:
    return os.environ.get("WEBHOOK_CRON_SECRET", "")


def admin_email() -> str:
    return os.environ.get("ADMIN_EMAIL", "").strip().lower()


def force_admin_password_reset() -> bool:
    """Set ADMIN_PASSWORD_RESET=true SEKALI untuk memaksa password admin kembali
    ke isi ADMIN_PASSWORD (dipakai kalau password admin lupa). Selain itu,
    password yang diganti dari halaman User TIDAK akan ditimpa saat restart."""
    return os.environ.get("ADMIN_PASSWORD_RESET", "").strip().lower() in ("1", "true", "yes")


def seed_admin_credentials() -> Tuple[str, str, str]:
    """(email, password, name) untuk akun admin yang dibuat saat startup."""
    return (
        os.environ["ADMIN_EMAIL"].lower().strip(),
        os.environ["ADMIN_PASSWORD"],
        os.environ.get("ADMIN_NAME", "Admin"),
    )
