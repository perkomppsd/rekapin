import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException

from ..db import db
from ..emailing import templates
from ..emailing.sender import send_email
from ..models import EmailTemplateCreate, EmailTemplateUpdate, SendEmailRequest, SendBulkReminderRequest
from ..security import get_current_user, require_admin
from ..services import history, scope

router = APIRouter(prefix="", tags=["email"])


# ---------- CRUD Template Email ----------
@router.get("/email-templates")
async def list_email_templates(user: dict = Depends(get_current_user)):
    """Daftar semua template email yang ada."""
    return await templates.get_all_templates()


@router.post("/email-templates")
async def create_email_template(payload: EmailTemplateCreate, user: dict = Depends(require_admin)):
    """Tambah template email baru."""
    tpl_id = (payload.id or payload.label.lower().replace(" ", "_")).strip()
    existing = await db.email_templates.find_one({"id": tpl_id})
    if existing:
        raise HTTPException(status_code=409, detail=f"Template dengan ID '{tpl_id}' sudah ada")

    doc = {
        "id": tpl_id,
        "label": payload.label.strip(),
        "subject": payload.subject.strip(),
        "body": payload.body.strip(),
        "fallbacks": payload.fallbacks or {},
        "internal": False,
    }
    await db.email_templates.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/email-templates/{template_id}")
async def update_email_template(template_id: str, payload: EmailTemplateUpdate, user: dict = Depends(require_admin)):
    """Edit subjek atau isi pesan template email."""
    existing = await db.email_templates.find_one({"id": template_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Template email tidak ditemukan")

    updates = {}
    if payload.label is not None:
        updates["label"] = payload.label.strip()
    if payload.subject is not None:
        updates["subject"] = payload.subject.strip()
    if payload.body is not None:
        updates["body"] = payload.body.strip()
    if payload.fallbacks is not None:
        updates["fallbacks"] = payload.fallbacks

    if updates:
        await db.email_templates.update_one({"id": template_id}, {"$set": updates})

    return await db.email_templates.find_one({"id": template_id}, {"_id": 0})


@router.delete("/email-templates/{template_id}")
async def delete_email_template(template_id: str, user: dict = Depends(require_admin)):
    """Hapus template email kustom."""
    existing = await db.email_templates.find_one({"id": template_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Template email tidak ditemukan")
    if existing.get("internal"):
        raise HTTPException(status_code=400, detail="Template sistem internal tidak boleh dihapus")

    await db.email_templates.delete_one({"id": template_id})
    return {"ok": True}


# ---------- Kirim Email ke Kandidat ----------
@router.post("/candidates/{candidate_id}/send-email")
async def send_email_to_candidate(candidate_id: str, payload: SendEmailRequest,
                                  user: dict = Depends(get_current_user)):
    existing = await db.candidates.find_one({"id": candidate_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan")
    scope.assert_can_email(existing, user)

    to = (existing.get("email") or "").strip()
    if not to or "@" not in to:
        raise HTTPException(status_code=400, detail="Email kandidat kosong")

    rendered = await templates.render_async(
        template_id=payload.template,
        candidate=existing,
        custom_subject=payload.subject,
        custom_body=payload.body,
    )

    if not rendered:
        raise HTTPException(status_code=400, detail="Gagal menyusun pesan email")

    email_id = await send_email(to=to, subject=rendered["subject"], html=rendered["html"])

    tpl_name = payload.template or "Pesan Kustom"
    await history.log(
        candidate_id, existing["nama"], "updated",
        history.marker("_email_sent", "Email Terkirim", new=f"{tpl_name} → {to}"),
        user,
    )
    return {"ok": True, "email_id": email_id}


# ---------- Kirim Reminder Massal (Bulk / Selected) ----------
@router.post("/candidates/send-bulk-reminder")
async def send_bulk_reminder(payload: SendBulkReminderRequest, user: dict = Depends(get_current_user)):
    """Kirim email reminder massal ke kandidat atau ringkasan internal."""
    from ..services.reminders import run_training_reminders

    # Jika target adalah email internal tim (Admin / Recruiter summary)
    if payload.target_type == "internal_team":
        import asyncio
        asyncio.create_task(run_training_reminders())
        return {"ok": True, "sent_count": 1, "target": "internal_team"}

    # Jika target adalah kandidat
    query = {}
    if payload.scope == "selected" and payload.candidate_ids:
        query = {"id": {"$in": payload.candidate_ids}}
    elif payload.scope == "training":
        query = {"status": {"$regex": "training|interview", "$options": "i"}}
    else:
        query = {"email": {"$exists": True, "$ne": ""}}

    candidates = await db.candidates.find(query, {"_id": 0}).to_list(1000)

    sent_count = 0
    errors = []

    for c in candidates:
        to = (c.get("email") or "").strip()
        if not to or "@" not in to:
            continue

        # Gabungkan data custom jika diberikan
        cand_data = dict(c)
        if payload.custom_tanggal:
            cand_data["tanggal_interview"] = payload.custom_tanggal
        if payload.custom_jam:
            cand_data["jam_interview"] = payload.custom_jam
        if payload.custom_metode:
            cand_data["metode_interview"] = payload.custom_metode
        if payload.custom_link:
            cand_data["link_online"] = payload.custom_link
        if payload.custom_catatan:
            cand_data["rencana_penempatan"] = payload.custom_catatan

        rendered = await templates.render_async(
            template_id=payload.template,
            candidate=cand_data,
            custom_subject=payload.subject,
            custom_body=payload.body,
        )

        if rendered:
            try:
                await send_email(to=to, subject=rendered["subject"], html=rendered["html"])
                sent_count += 1
                await history.log(
                    c["id"], c.get("nama", ""), "updated",
                    history.marker("_email_sent", "Reminder Terkirim", new=f"Massal ({payload.template or 'Reminder'}) → {to}"),
                    user,
                )
            except Exception as e:
                errors.append(f"Gagal ke {to}: {str(e)}")

    return {"ok": True, "sent_count": sent_count, "errors": errors}
