"""Endpoint login & profil user yang sedang login."""

from fastapi import APIRouter, Depends, HTTPException, Request

from .. import config
from ..db import db
from ..models import LoginRequest, UserOut
from ..security import create_access_token, get_current_user, verify_password
from ..services import ratelimit

router = APIRouter(tags=["auth"])

RATE_NS = "login"
RATE_PESAN = ("Terlalu banyak percobaan login yang gagal. "
              "Coba lagi beberapa menit lagi.")


@router.post("/auth/login")
async def login(payload: LoginRequest, request: Request):
    # Hanya percobaan GAGAL yang dihitung, jadi user yang passwordnya benar
    # tidak pernah terkunci walau login berkali-kali.
    ratelimit.ensure(request, namespace=RATE_NS, limit=config.LOGIN_RATE_LIMIT,
                     window_minutes=config.LOGIN_RATE_WINDOW_MINUTES, pesan=RATE_PESAN)
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        ratelimit.record(request, namespace=RATE_NS,
                         window_minutes=config.LOGIN_RATE_WINDOW_MINUTES)
        raise HTTPException(status_code=401, detail="Email atau password salah")
    token = create_access_token(user["id"], user["email"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user["id"], "email": user["email"],
                 "name": user.get("name", ""), "role": user.get("role", "recruiter")},
    }


@router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(id=user["id"], email=user["email"],
                   name=user.get("name", ""), role=user.get("role", "recruiter"))
