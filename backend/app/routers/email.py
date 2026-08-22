"""Kirim email template ke kandidat secara manual."""

from fastapi import APIRouter, Depends, HTTPException

from ..db import db
from ..emailing import templates
from ..models import SendEmailRequest
from ..security import get_current_user
from ..services import history, scope
from ..services.notifications import send_template

router = APIRouter(prefix="/candidates", tags=["email"])


@router.post("/{candidate_id}/send-email")
async def send_email_to_candidate(candidate_id: str, payload: SendEmailRequest,
                                  user: dict = Depends(get_current_user)):
    existing = await db.candidates.find_one({"id": candidate_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan")
    scope.assert_can_email(existing, user)

    to = (existing.get("email") or "").strip()
    if not to or "@" not in to:
        raise HTTPException(status_code=400, detail="Email kandidat kosong")
    if payload.template not in templates.TEMPLATE_BY_ID:
        raise HTTPException(status_code=400, detail="Template tidak dikenal")

    email_id = await send_template(existing, payload.template)
    await history.log(
        candidate_id, existing["nama"], "updated",
        history.marker("_email_sent", "Email Terkirim", new=f"{payload.template} → {to}"),
        user,
    )
    return {"ok": True, "email_id": email_id}
