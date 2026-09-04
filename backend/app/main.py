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
from .routers import (applications, auth, candidates, cron, custom_fields, email,
                      export, history, jobs, meta, public, references, users)
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
    references.router,
    jobs.router,
    applications.router,
    public.router,
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


@api_router.get("/health")
async def health_check():
    return {"status": "ok", "app": "HR Recruitment API"}


app.include_router(api_router)
app.include_router(cron.public_router)  # /api/cron/... (dipanggil cron platform)

from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root & Frontend Build Directory
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
FRONTEND_BUILD_DIR = PROJECT_ROOT / "frontend" / "build"
UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"

# Mount /uploads if exists
if UPLOADS_DIR.exists():
    app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Mount /static from React build if exists
if (FRONTEND_BUILD_DIR / "static").exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_BUILD_DIR / "static")), name="static")

# Catch-all route to serve React frontend SPA (index.html)
@app.get("/{full_path:path}", include_in_schema=False)
async def serve_react_spa(full_path: str):
    # Pass through /api routes if unhandled
    if full_path.startswith("api/") or full_path == "api":
        return {"detail": "Not Found"}
    
    file_path = FRONTEND_BUILD_DIR / full_path
    if file_path.is_file():
        return FileResponse(str(file_path))
    
    index_file = FRONTEND_BUILD_DIR / "index.html"
    if index_file.is_file():
        return FileResponse(str(index_file))
    
    return {"message": "HR Recruitment API is running. Build frontend to view UI."}


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
    # Password TIDAK ditimpa setiap restart — kalau tidak, penggantian password
    # dari halaman User selalu hilang saat deploy. Reset hanya bila diminta
    # eksplisit lewat ADMIN_PASSWORD_RESET=true.
    if config.force_admin_password_reset() and not verify_password(
        admin_password, existing["password_hash"]
    ):
        updates["password_hash"] = hash_password(admin_password)
        logger.warning("ADMIN_PASSWORD_RESET aktif — password admin di-reset dari .env")
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
    from .services.seed_units import seed_initial_units
    await seed_initial_units()


@app.on_event("shutdown")
async def on_shutdown():
    db.close()
