"""Model Pydantic. Model kandidat DIBANGUN OTOMATIS dari app/schema.py —
jadi menambah kolom kandidat cukup dilakukan di schema.py, tidak di sini.

Model yang perlu diedit manual di file ini hanya yang bukan kandidat
(login, user, custom field, request email).
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, create_model

from . import config, schema

_PASSWORD = Field(min_length=config.MIN_PASSWORD_LENGTH)

# ---------------------------------------------------------------------------
# Model kandidat (generated)
# ---------------------------------------------------------------------------
_ALLOW_EXTRA = ConfigDict(extra="allow")


def _create_fields(*, optional_none: bool) -> Dict[str, tuple]:
    """Bangun definisi field untuk create_model dari FIELDS di schema.py.

    optional_none=True -> semua field Optional dengan default None (untuk PATCH/PUT).
    """
    out: Dict[str, tuple] = {}
    for f in schema.FIELDS:
        if optional_none:
            out[f.key] = (Optional[f.py_type], None)
        elif f.required:
            out[f.key] = (f.py_type, ...)
        else:
            out[f.key] = (Optional[f.py_type], f.default)
    out["custom_data"] = (Optional[Dict[str, Any]], None)
    return out


CandidateBase = create_model(
    "CandidateBase", __config__=_ALLOW_EXTRA, **_create_fields(optional_none=False)
)

CandidateCreate = create_model(
    "CandidateCreate", __base__=CandidateBase
)

CandidateUpdate = create_model(
    "CandidateUpdate", __config__=_ALLOW_EXTRA, **_create_fields(optional_none=True)
)

Candidate = create_model(
    "Candidate",
    __base__=CandidateBase,
    id=(str, ...),
    created_at=(str, ...),
    updated_at=(str, ...),
    created_by=(Optional[str], ""),
    created_by_email=(Optional[str], ""),
)


class BulkImportRequest(BaseModel):
    # Sengaja dict mentah, bukan List[CandidateCreate]: validasi dilakukan
    # per baris di services/candidates.py supaya satu baris rusak tidak
    # menggagalkan seluruh import.
    items: List[Dict[str, Any]]


class SendEmailRequest(BaseModel):
    template: str  # lihat app/emailing/templates.py


# ---------------------------------------------------------------------------
# Auth & user
# ---------------------------------------------------------------------------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str = _PASSWORD
    role: str = "recruiter"  # admin | recruiter


class UserUpdate(BaseModel):
    name: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=config.MIN_PASSWORD_LENGTH)
    role: Optional[str] = None


# ---------------------------------------------------------------------------
# Kolom kustom (dibuat admin lewat halaman Setting)
# ---------------------------------------------------------------------------
class ReferenceItemCreate(BaseModel):
    nama: str
    keterangan: Optional[str] = ""


class ReferenceItemUpdate(BaseModel):
    nama: Optional[str] = None
    keterangan: Optional[str] = None


class CustomFieldCreate(BaseModel):
    label: str
    type: str = "text"  # text | number | select
    options: Optional[List[str]] = None


class CustomField(BaseModel):
    id: str
    key: str
    label: str
    type: str
    options: Optional[List[str]] = None
    created_at: str
