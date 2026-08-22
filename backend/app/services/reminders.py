"""Job reminder: kandidat yang mendekati tenggat.

Menambah jenis reminder baru: tambah satu `ReminderRule` di `RULES`.
  date_field  field tanggal acuan di data kandidat
  period_days jarak dari tanggal acuan ke tenggat (0 = field-nya sudah tenggat)
  only_if     kandidat mana yang diawasi

Hari pengingat diatur di app/config.py -> REMINDER_DAYS (default H-7 & hari-H).
"""

import logging
from dataclasses import dataclass
from datetime import date, timedelta
from html import escape
from typing import Callable, Dict, List, Tuple

from .. import config
from ..db import db
from ..emailing.sender import button, send_email, wrap
from ..schema import Kontrak, Training, has_contract, is_blacklisted
from .common import parse_date

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ReminderRule:
    key: str
    label: str                       # judul bagian di email
    date_field: str
    period_days: int
    only_if: Callable[[dict], bool]

    def due_date(self, candidate: dict):
        start = parse_date(candidate.get(self.date_field))
        if start is None:
            return None
        return start + timedelta(days=self.period_days)


def _sedang_training(c: dict) -> bool:
    return (c.get("status_training") or "").lower() == Training.ONGOING.lower()


def _kontrak_berjalan(c: dict) -> bool:
    return has_contract(c)


RULES: Tuple[ReminderRule, ...] = (
    ReminderRule(
        key="training",
        label=f"Masa Training {config.TRAINING_PERIOD_DAYS // 30} Bulan Berakhir",
        date_field="tanggal_mulai_training",
        period_days=config.TRAINING_PERIOD_DAYS,
        only_if=_sedang_training,
    ),
    ReminderRule(
        key="kontrak",
        label="Kontrak Kerja Habis",
        date_field="tanggal_habis_kontrak",
        period_days=0,                       # field-nya sudah tanggal habis
        only_if=_kontrak_berjalan,
    ),
)

# Kolom tabel di email: (judul, cara ambil nilai)
REMINDER_COLUMNS = (
    ("Nama", lambda c: c.get("nama", "")),
    ("Posisi", lambda c: c.get("posisi_fix") or c.get("apply", "")),
    ("Penempatan", lambda c: c.get("penempatan_fix") or c.get("rencana_penempatan", "")),
    ("Tenggat", lambda c: c.get("_tenggat", "")),
    ("PIC", lambda c: c.get("pic", "")),
)

_CELL = 'style="padding:8px;border-bottom:1px solid #e5e7eb"'


def _table(candidates: List[dict]) -> str:
    head = "".join(f'<th style="padding:8px">{escape(t)}</th>' for t, _ in REMINDER_COLUMNS)
    body = "".join(
        "<tr>" + "".join(f'<td {_CELL}>{escape(str(get(c) or ""))}</td>'
                         for _, get in REMINDER_COLUMNS) + "</tr>"
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


def _bucket_title(rule: ReminderRule, days_left: int) -> str:
    kapan = "Hari Ini" if days_left == 0 else f"H-{days_left} ({days_left} hari lagi)"
    return f"{rule.label} — {kapan}"


async def collect() -> Dict[Tuple[str, int], List[dict]]:
    """Kelompokkan kandidat per (jenis reminder, sisa hari)."""
    docs = await db.candidates.find({}, {"_id": 0}).to_list(config.QUERY_LIMIT)
    today = date.today()
    buckets: Dict[Tuple[str, int], List[dict]] = {}
    for c in docs:
        if is_blacklisted(c):
            continue
        for rule in RULES:
            if not rule.only_if(c):
                continue
            due = rule.due_date(c)
            if due is None:
                continue
            days_left = (due - today).days
            if days_left in config.REMINDER_DAYS:
                item = dict(c)
                item["_tenggat"] = due.strftime("%Y-%m-%d")
                buckets.setdefault((rule.key, days_left), []).append(item)
    return buckets


async def run_training_reminders() -> None:
    """Kirim satu email ringkasan berisi semua reminder yang jatuh tempo."""
    try:
        buckets = await collect()
        semua = [c for group in buckets.values() for c in group]
        if not semua:
            logger.info("reminder: tidak ada kandidat yang perlu diingatkan")
            return

        today = date.today()
        sections = ""
        for rule in RULES:
            for days in sorted(config.REMINDER_DAYS, reverse=True):
                sections += _section(_bucket_title(rule, days),
                                     buckets.get((rule.key, days), []))

        inner = (
            f'<h2 style="margin:0 0 4px">Reminder Tenggat Kandidat</h2>'
            f'<p style="color:#6b7280;margin:0 0 16px">Ringkasan kandidat yang '
            f'mendekati akhir masa training atau habis kontrak.</p>'
            f'{sections}'
            f'{button("Buka Dashboard Rekapin", config.PUBLIC_APP_URL.rstrip("/"))}'
        )
        subject = f"[Rekapin] Reminder Tenggat Kandidat — {today.strftime('%d %b %Y')}"
        html = wrap(inner)

        recipients = set()
        admin = config.admin_email()
        if admin:
            recipients.add(admin)
        for c in semua:
            pic_email = (c.get("pic_email") or "").strip().lower()
            if pic_email and "@" in pic_email:
                recipients.add(pic_email)

        for to in recipients:
            await send_email(to=to, subject=subject, html=html)
        logger.info("reminder: dikirim ke %d penerima", len(recipients))
    except Exception as e:
        logger.exception("job reminder gagal: %s", e)
