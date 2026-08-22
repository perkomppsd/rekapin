"""Job reminder: kandidat yang mendekati akhir masa training.

Periode training & hari pengingat diatur di app/config.py
(TRAINING_PERIOD_DAYS, TRAINING_REMINDER_DAYS).
"""

import logging
from datetime import date, datetime
from html import escape
from typing import Dict, List

from .. import config
from ..db import db
from ..emailing.sender import button, send_email, wrap
from ..schema import Training, is_blacklisted

logger = logging.getLogger(__name__)

# Kolom yang ditampilkan di tabel email reminder: (judul, fungsi ambil nilai)
REMINDER_COLUMNS = (
    ("Nama", lambda c: c.get("nama", "")),
    ("Posisi", lambda c: c.get("posisi_fix") or c.get("apply", "")),
    ("Penempatan", lambda c: c.get("penempatan_fix") or c.get("rencana_penempatan", "")),
    ("Mulai Training", lambda c: c.get("tanggal_mulai_training", "")),
    ("PIC", lambda c: c.get("pic", "")),
)

_CELL = 'style="padding:8px;border-bottom:1px solid #e5e7eb"'


def _table(candidates: List[dict]) -> str:
    head = "".join(f'<th style="padding:8px">{escape(title)}</th>'
                   for title, _ in REMINDER_COLUMNS)
    body = "".join(
        "<tr>" + "".join(f'<td {_CELL}>{escape(str(getter(c) or ""))}</td>'
                         for _, getter in REMINDER_COLUMNS) + "</tr>"
        for c in candidates
    )
    return (
        f'<table role="presentation" style="width:100%;border-collapse:collapse;'
        f'font-family:Arial,sans-serif;font-size:14px">'
        f'<thead><tr style="background:#f3f4f6;text-align:left">{head}</tr></thead>'
        f'<tbody>{body}</tbody></table>'
    )


def _section(title: str, candidates: List[dict]) -> str:
    if not candidates:
        return ""
    return (
        f'<h3 style="font-family:Arial,sans-serif;color:#111827;margin:24px 0 8px">'
        f'{escape(title)}</h3>{_table(candidates)}'
    )


def _bucket_title(days_left: int) -> str:
    if days_left == 0:
        return f"Hari Ini (Selesai {config.TRAINING_PERIOD_DAYS // 30} bulan)"
    return f"H-{days_left} ({days_left} hari lagi)"


async def collect_buckets() -> Dict[int, List[dict]]:
    """Kelompokkan kandidat training berdasarkan sisa hari masa training."""
    docs = await db.candidates.find({}, {"_id": 0}).to_list(config.QUERY_LIMIT)
    buckets: Dict[int, List[dict]] = {d: [] for d in config.TRAINING_REMINDER_DAYS}
    today = date.today()
    for d in docs:
        if (d.get("status_training") or "").lower() != Training.ONGOING.lower():
            continue
        if is_blacklisted(d):
            continue
        mulai = d.get("tanggal_mulai_training") or ""
        if not mulai:
            continue
        try:
            mulai_d = datetime.strptime(mulai, "%Y-%m-%d").date()
        except ValueError:
            continue
        days_left = config.TRAINING_PERIOD_DAYS - (today - mulai_d).days
        if days_left in buckets:
            buckets[days_left].append(d)
    return buckets


async def run_training_reminders() -> None:
    try:
        buckets = await collect_buckets()
        everyone = [c for group in buckets.values() for c in group]
        if not everyone:
            logger.info("training-reminder: no candidates to notify")
            return

        today = date.today()
        sections = "".join(
            _section(_bucket_title(days), buckets[days])
            for days in sorted(buckets, reverse=True)
        )
        inner = (
            f'<h2 style="margin:0 0 4px">Reminder Training '
            f'{config.TRAINING_PERIOD_DAYS // 30} Bulan</h2>'
            f'<p style="color:#6b7280;margin:0 0 16px">Ringkasan kandidat yang '
            f'mendekati akhir masa training.</p>'
            f'{sections}'
            f'{button("Buka Dashboard Rekapin", config.PUBLIC_APP_URL.rstrip("/"))}'
        )
        subject = (f"[Rekapin] Reminder Training {config.TRAINING_PERIOD_DAYS // 30} Bulan"
                   f" — {today.strftime('%d %b %Y')}")
        html = wrap(inner)

        recipients = set()
        admin = config.admin_email()
        if admin:
            recipients.add(admin)
        for cand in everyone:
            pic_email = (cand.get("pic_email") or "").strip().lower()
            if pic_email and "@" in pic_email:
                recipients.add(pic_email)

        for to in recipients:
            await send_email(to=to, subject=subject, html=html)
        logger.info("training-reminder: sent to %d recipients", len(recipients))
    except Exception as e:
        logger.exception("training-reminder job failed: %s", e)
