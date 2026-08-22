"""Perakitan aplikasi FastAPI.

Menambah kelompok endpoint baru:
  1. Buat file di app/routers/.
  2. Tambahkan router-nya ke daftar ROUTERS di bawah.
"""

import logging
import uuid

from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

from . import config, db
from .routers import (auth, candidates, cron, custom_fields, email, export,
                      history, meta, users)
from .security import hash_password, verify_password
from .services.common import now_iso

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title=config.APP_TITLE)

# Semua endpoint aplikasi berada di bawah /api.
api_router = APIRouter(prefix="/api")

# Urutan penting: path statis (/candidates/export, /candidates/history) harus
# terdaftar sebelum path berparameter (/candidates/{candidate_id}).
ROUTERS = (
    auth.router,
    users.router,
    custom_fields.router,
    meta.router,
    export.router,
    history.router,
    email.router,
    cron.admin_router,
    candidates.router,
)

for r in ROUTERS:
    api_router.include_router(r)


@api_router.get("/")
async def root():
    return {"message": "HR Recruitment API"}


app.include_router(api_router)
app.include_router(cron.public_router)  # /api/cron/... (dipanggil cron platform)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Startup / shutdown ----------
async def seed_admin() -> None:
    """Pastikan akun admin dari environment selalu ada & sinkron."""
    admin_email, admin_password, admin_name = config.seed_admin_credentials()
    existing = await db.db.users.find_one({"email": admin_email})
    if existing is None:
        await db.db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": admin_name,
            "role": "admin",
            "created_at": now_iso(),
        })
        return
    updates = {}
    if not verify_password(admin_password, existing["password_hash"]):
        updates["password_hash"] = hash_password(admin_password)
    if existing.get("role") != "admin":
        updates["role"] = "admin"
    if "id" not in existing:
        updates["id"] = str(uuid.uuid4())
    if updates:
        await db.db.users.update_one({"email": admin_email}, {"$set": updates})


@app.on_event("startup")
async def on_startup():
    await db.ensure_indexes()
    await seed_admin()


@app.on_event("shutdown")
async def on_shutdown():
    db.close()
