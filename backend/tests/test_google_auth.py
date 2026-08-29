"""Verifikasi token Google — diuji dengan kunci palsu buatan sendiri.

Token asli Google tidak bisa dibuat di test, jadi kita bikin pasangan kunci
RSA sendiri, tandatangani token seperti Google, lalu arahkan verifikator ke
kunci publik kita. Dengan begitu logika pemeriksaannya benar-benar teruji:
tanda tangan, audience, issuer, kedaluwarsa, dan email_verified.
"""

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "test_unit")

jwt = pytest.importorskip("jwt")
pytest.importorskip("cryptography")

from cryptography.hazmat.primitives import serialization          # noqa: E402
from cryptography.hazmat.primitives.asymmetric import rsa         # noqa: E402

from app import config                                            # noqa: E402
from app.services import google_auth                              # noqa: E402

CLIENT_ID = "uji-123.apps.googleusercontent.com"


@pytest.fixture(scope="module")
def kunci():
    priv = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem_priv = priv.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    pem_pub = priv.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return pem_priv, priv.public_key()


@pytest.fixture(autouse=True)
def _pasang(monkeypatch, kunci):
    """Arahkan verifikator ke kunci uji, bukan ke server Google."""
    _priv, pub = kunci
    monkeypatch.setattr(config, "GOOGLE_CLIENT_ID", CLIENT_ID)

    class KunciPalsu:
        key = pub

    class JwksPalsu:
        def get_signing_key_from_jwt(self, _token):
            return KunciPalsu()

    monkeypatch.setattr(google_auth, "_jwks", lambda: JwksPalsu())


def buat_token(kunci, **ubah):
    priv, _ = kunci
    sekarang = datetime.now(timezone.utc)
    isi = {
        "iss": "https://accounts.google.com",
        "aud": CLIENT_ID,
        "sub": "1234567890",
        "email": "Wardah@Gmail.com",
        "email_verified": True,
        "name": "Wardah",
        "iat": sekarang,
        "exp": sekarang + timedelta(hours=1),
    }
    isi.update(ubah)
    return jwt.encode(isi, priv, algorithm="RS256")


def test_token_sah_diterima(kunci):
    hasil = google_auth.verifikasi(buat_token(kunci))
    assert hasil["email"] == "wardah@gmail.com", "email harus dinormalisasi lowercase"
    assert hasil["nama"] == "Wardah"
    assert hasil["sub"] == "1234567890"


def test_token_untuk_aplikasi_lain_ditolak(kunci):
    """Tanpa cek audience, token dari aplikasi Google lain bisa dipakai masuk."""
    with pytest.raises(Exception) as e:
        google_auth.verifikasi(buat_token(kunci, aud="aplikasi-lain.apps.googleusercontent.com"))
    assert e.value.status_code == 401


def test_token_kedaluwarsa_ditolak(kunci):
    lampau = datetime.now(timezone.utc) - timedelta(hours=2)
    with pytest.raises(Exception) as e:
        google_auth.verifikasi(buat_token(kunci, exp=lampau, iat=lampau))
    assert e.value.status_code == 401


def test_penerbit_bukan_google_ditolak(kunci):
    with pytest.raises(Exception) as e:
        google_auth.verifikasi(buat_token(kunci, iss="https://jahat.example.com"))
    assert e.value.status_code == 401


def test_email_belum_diverifikasi_ditolak(kunci):
    with pytest.raises(Exception) as e:
        google_auth.verifikasi(buat_token(kunci, email_verified=False))
    assert e.value.status_code == 401


def test_token_tanpa_email_ditolak(kunci):
    with pytest.raises(Exception) as e:
        google_auth.verifikasi(buat_token(kunci, email=""))
    assert e.value.status_code == 401


def test_token_ditandatangani_kunci_lain_ditolak(kunci, monkeypatch):
    """Inti keamanannya: token buatan sendiri tidak boleh lolos."""
    penyerang = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = penyerang.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption())
    palsu = buat_token((pem, None))
    with pytest.raises(Exception) as e:
        google_auth.verifikasi(palsu)
    assert e.value.status_code == 401


def test_ditolak_kalau_client_id_kosong(monkeypatch, kunci):
    monkeypatch.setattr(config, "GOOGLE_CLIENT_ID", "")
    with pytest.raises(Exception) as e:
        google_auth.verifikasi(buat_token(kunci))
    assert e.value.status_code == 503
