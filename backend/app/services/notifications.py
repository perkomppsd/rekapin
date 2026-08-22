"""Email otomatis yang dipicu perubahan status kandidat.

Cara menambah pemicu baru: tambah satu `Trigger` di `TRIGGERS`.
  when            -> fungsi (before, after) -> bool
  template        -> id template di app/emailing/templates.py (dikirim ke kandidat)
  notify_internal -> True kalau harus mengirim notifikasi ke tim internal
"""

import logging
from dataclasses import dataclass
from html import escape
from typing import Callable, Optional, Tuple

from .. import config
from ..emailing import templates
from ..emailing.sender import send_email
from ..schema import INTERVIEW_INVITE_STATUSES, Interview, Ttd

logger = logging.getLogger(__name__)


def _changed_to(before: dict, after: dict, key: str, value: str) -> bool:
    return after.get(key) == value and (before or {}).get(key) != value


def _changed_to_any(before: dict, after: dict, key: str, values) -> bool:
    return after.get(key) in values and (before or {}).get(key) != after.get(key)


def _filled_in(before: dict, after: dict, key: str) -> bool:
    return bool(after.get(key)) and after.get(key) != (before or {}).get(key)


@dataclass(frozen=True)
class Trigger:
    name: str
    when: Callable[[dict, dict], bool]
    template: Optional[str] = None
    notify_internal: bool = False


TRIGGERS: Tuple[Trigger, ...] = (
    Trigger(
        name="Interview dijadwalkan -> undangan interview",
        when=lambda b, a: _changed_to_any(b, a, "status_interview", INTERVIEW_INVITE_STATUSES),
        template="panggilan_interview",
    ),
    Trigger(
        name="Lolos interview -> undangan tanda tangan",
        when=lambda b, a: _changed_to(b, a, "status_interview", Interview.PASSED),
        template="lolos_ttd",
    ),
    Trigger(
        name="Penempatan fix -> notifikasi tim internal",
        when=lambda b, a: _filled_in(b, a, "penempatan_fix"),
        notify_internal=True,
    ),
    Trigger(
        name="Tanda tangan selesai -> notifikasi tim internal",
        when=lambda b, a: _changed_to(b, a, "status_tanda_tangan", Ttd.SIGNED),
        notify_internal=True,
    ),
)


async def notify_internal_hire(candidate: dict) -> None:
    """Kirim notifikasi 'kandidat baru diterima' ke tim internal."""
    if not config.HIRE_NOTIFY_EMAIL:
        return
    rendered = templates.render(
        "kandidat_baru_internal", candidate,
        extra={"penerima": escape(config.HIRE_NOTIFY_NAME)},
    )
    if rendered:
        await send_email(to=config.HIRE_NOTIFY_EMAIL, **rendered)


async def send_template(candidate: dict, template_id: str) -> Optional[str]:
    """Kirim satu template ke email kandidat."""
    to = (candidate.get("email") or "").strip()
    if not to:
        return None
    rendered = templates.render(template_id, candidate)
    if not rendered:
        logger.warning("template tidak dikenal: %s", template_id)
        return None
    return await send_email(to=to, **rendered)


async def on_candidate_change(before: dict, after: dict) -> None:
    """Jalankan semua TRIGGERS. Dipanggil sebagai background task."""
    try:
        for trigger in TRIGGERS:
            if not trigger.when(before or {}, after or {}):
                continue
            if trigger.template:
                await send_template(after, trigger.template)
            if trigger.notify_internal:
                await notify_internal_hire(after)
    except Exception as e:
        logger.exception("auto-email failed: %s", e)
