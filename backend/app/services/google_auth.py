"""Verifikasi login Google (Google Identity Services).

Alurnya: tombol Google di frontend menghasilkan ID token (JWT) yang
ditandatangani Google. Backend memverifikasi tanda tangannya memakai kunci
publik Google, lalu memastikan email-nya terdaftar sebagai user aplikasi.

Yang WAJIB diperiksa (kalau salah satu dilewat, siapa pun bisa masuk):
  * tanda tangan  -> token benar dari Google, bukan buatan orang
  * aud           -> token memang untuk aplikasi ini, bukan aplikasi lain
  * iss           -> penerbitnya Google
  * exp           -> belum kedaluwarsa (dicek otomatis oleh PyJWT)
  * email_verified-> email-nya sudah diverifikasi Google

Tidak butuh client secret: ID token diverifikasi dengan kunci publik.
"""

import logging
from typing import Optional

import jwt
from fastapi import HTTPException
from jwt import PyJWKClient

from .. import config

logger = logging.getLogger(__name__)

_jwks_client: Optional[PyJWKClient] = None


def _jwks() -> PyJWKClient:
    """Klien kunci publik Google (di-cache agar tidak mengunduh tiap login)."""
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(config.GOOGLE_JWKS_URL, cache_keys=True)
    return _jwks_client


def aktif() -> bool:
    return bool(config.GOOGLE_CLIENT_ID)


def verifikasi(credential: str) -> dict:
    """Verifikasi ID token Google -> data pengguna. Raise HTTPException kalau gagal."""
    if not aktif():
        raise HTTPException(
            status_code=503,
            detail="Login Google belum dikonfigurasi (GOOGLE_CLIENT_ID kosong)",
        )
    if not credential:
        raise HTTPException(status_code=400, detail="Token Google kosong")

    try:
        kunci = _jwks().get_signing_key_from_jwt(credential).key
        data = jwt.decode(
            credential,
            kunci,
            algorithms=["RS256"],
            audience=config.GOOGLE_CLIENT_ID,
            issuer=config.GOOGLE_ISSUERS,
            options={"require": ["exp", "iat", "aud", "iss", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesi Google kedaluwarsa, coba lagi")
    except jwt.InvalidAudienceError:
        raise HTTPException(status_code=401,
                            detail="Token Google bukan untuk aplikasi ini")
    except jwt.InvalidTokenError as e:
        logger.warning("Token Google ditolak: %s", e)
        raise HTTPException(status_code=401, detail="Token Google tidak valid")
    except Exception as e:                      # gangguan jaringan ke Google
        logger.error("Gagal memverifikasi token Google: %s", e)
        raise HTTPException(status_code=503,
                            detail="Tidak bisa menghubungi Google. Coba lagi.")

    if not data.get("email"):
        raise HTTPException(status_code=401, detail="Akun Google tanpa email")
    if not data.get("email_verified"):
        raise HTTPException(status_code=401,
                            detail="Email akun Google ini belum diverifikasi")
    return {
        "email": data["email"].strip().lower(),
        "nama": data.get("name", ""),
        "sub": data["sub"],
    }
