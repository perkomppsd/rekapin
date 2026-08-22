"""Endpoint job terjadwal (dipanggil cron platform) + trigger manual admin."""

import asyncio
import hmac

from fastapi import APIRouter, Depends, HTTPException, Request

from .. import config
from ..security import require_admin
from ..services.reminders import run_training_reminders

# Cron dipanggil dari luar /api/... prefix router utama, jadi pakai router sendiri.
public_router = APIRouter(prefix="/api/cron", tags=["cron"])
admin_router = APIRouter(prefix="/candidates", tags=["cron"])


@public_router.post("/training-reminder")
async def cron_training_reminder(request: Request):
    # Endpoint cron harus langsung membalas 2xx; pekerjaan dijalankan di background.
    secret = config.cron_secret()
    if not secret:
        # Tanpa secret, endpoint ini terbuka untuk siapa pun -> matikan saja.
        raise HTTPException(status_code=503, detail="WEBHOOK_CRON_SECRET belum diset")
    auth = request.headers.get("Authorization", "")
    if not auth or not hmac.compare_digest(auth, f"Bearer {secret}"):
        raise HTTPException(status_code=401, detail="unauthorized")
    asyncio.create_task(run_training_reminders())
    return {"ok": True, "queued": True}


@admin_router.post("/training-reminder/run")
async def run_training_reminder_now(user: dict = Depends(require_admin)):
    asyncio.create_task(run_training_reminders())
    return {"ok": True, "queued": True}
