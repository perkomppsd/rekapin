"""Endpoint login & profil user yang sedang login."""

from fastapi import APIRouter, Depends, HTTPException

from ..db import db
from ..models import LoginRequest, UserOut
from ..security import create_access_token, get_current_user, verify_password

router = APIRouter(tags=["auth"])


@router.post("/auth/login")
async def login(payload: LoginRequest):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
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
