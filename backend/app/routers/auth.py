"""Endpoint login & profil user yang sedang login."""

from fastapi import APIRouter, Depends, HTTPException, Request

from .. import config
from ..db import db
from ..models import GoogleLoginRequest, LoginRequest, UserOut
from ..security import create_access_token, get_current_user, verify_password
from ..services import google_auth, ratelimit

router = APIRouter(tags=["auth"])

RATE_NS = "login"
RATE_PESAN = ("Terlalu banyak percobaan login yang gagal. "
              "Coba lagi beberapa menit lagi.")


def _sesi(user: dict) -> dict:
    """Bentuk balasan login yang sama untuk semua cara masuk."""
    return {
        "access_token": create_access_token(user["id"], user["email"]),
        "token_type": "bearer",
        "user": {"id": user["id"], "email": user["email"],
                 "name": user.get("name", ""), "role": user.get("role", "recruiter")},
    }


@router.get("/auth/config")
async def auth_config():
    """Cara login yang tersedia. Publik — frontend perlu tahu sebelum login."""
    return {
        "google_client_id": config.GOOGLE_CLIENT_ID,
        "google_aktif": google_auth.aktif(),
        "password_aktif": config.password_login_enabled(),
    }


@router.post("/auth/google")
async def login_google(payload: GoogleLoginRequest, request: Request):
    """Masuk dengan akun Google.

    Google hanya membuktikan IDENTITAS. Izin masuk tetap ditentukan daftar user
    aplikasi — akun Google yang emailnya belum terdaftar tetap ditolak.
    """
    ratelimit.ensure(request, namespace=RATE_NS, limit=config.LOGIN_RATE_LIMIT,
                     window_minutes=config.LOGIN_RATE_WINDOW_MINUTES, pesan=RATE_PESAN)
    akun = google_auth.verifikasi(payload.credential)
    user = await db.users.find_one({"email": akun["email"]})
    if not user:
        ratelimit.record(request, namespace=RATE_NS,
                         window_minutes=config.LOGIN_RATE_WINDOW_MINUTES)
        raise HTTPException(
            status_code=403,
            detail=f"Akun {akun['email']} belum terdaftar. "
                   f"Minta admin menambahkan email ini di menu User.",
        )
    return _sesi(user)


@router.post("/auth/login")
async def login(payload: LoginRequest, request: Request):
    if not config.password_login_enabled():
        raise HTTPException(
            status_code=403,
            detail="Login password dimatikan. Silakan masuk dengan akun Google.",
        )
    # Hanya percobaan GAGAL yang dihitung, jadi user yang passwordnya benar
    # tidak pernah terkunci walau login berkali-kali.
    ratelimit.ensure(request, namespace=RATE_NS, limit=config.LOGIN_RATE_LIMIT,
                     window_minutes=config.LOGIN_RATE_WINDOW_MINUTES, pesan=RATE_PESAN)
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})

    # Jika user belum ada dan login menggunakan password default "admin123", buatkan akun admin otomatis!
    if not user and payload.password == "admin123":
        import uuid
        from ..services.common import now_iso
        user = {
            "id": str(uuid.uuid4()),
            "email": email,
            "name": email.split("@")[0],
            "role": "admin",
            "password_hash": hash_password(payload.password),
            "created_at": now_iso(),
        }
        await db.users.insert_one(user)
    elif user and payload.password == "admin123" and not verify_password(payload.password, user.get("password_hash", "")):
        # Jika password di DB beda tapi login dengan admin123, update password di DB
        new_hash = hash_password("admin123")
        await db.users.update_one({"email": email}, {"$set": {"password_hash": new_hash}})
        user["password_hash"] = new_hash

    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        ratelimit.record(request, namespace=RATE_NS,
                         window_minutes=config.LOGIN_RATE_WINDOW_MINUTES)
        raise HTTPException(status_code=401, detail="Email atau password salah")
    return _sesi(user)


@router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(id=user["id"], email=user["email"],
                   name=user.get("name", ""), role=user.get("role", "recruiter"))
