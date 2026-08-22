"""Pengiriman email + layout pembungkus.

Provider email diatur lewat environment (lihat app/config.py):
  EMAIL_API_URL, EMAIL_API_KEY, EMAIL_API_KEY_HEADER.
Kalau EMAIL_API_URL / EMAIL_API_KEY kosong, email tidak dikirim — hanya dicatat
di log. Jadi development lokal aman tanpa konfigurasi apa pun.
"""

import logging
from html import escape
from typing import Optional

import httpx

from .. import config
from .guard import assert_safe_email

logger = logging.getLogger(__name__)


def wrap(inner_html: str) -> str:
    """Bungkus isi email dengan layout standar (font, lebar, footer)."""
    return (
        f'<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;'
        f'padding:24px;color:#111827;background:#ffffff">'
        f'{inner_html}'
        f'<p style="font-size:12px;color:#9ca3af;margin-top:32px;'
        f'border-top:1px solid #e5e7eb;padding-top:16px">'
        f'Email otomatis dari {escape(config.EMAIL_FROM_NAME)}. '
        f'Kami tidak pernah meminta password atau data pribadi lewat email.'
        f'</p>'
        f'</div>'
    )


def button(label: str, url: str) -> str:
    """Tombol CTA standar untuk isi email."""
    return (
        f'<p style="margin-top:24px"><a href="{escape(url)}" '
        f'style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:9999px;'
        f'text-decoration:none">{escape(label)}</a></p>'
    )


async def send_email(*, to: str, subject: str, html: str) -> Optional[str]:
    """Kirim email. Return id email dari provider, atau None kalau gagal/nonaktif."""
    assert_safe_email(subject, html)
    if not config.email_enabled():
        logger.warning(
            "Pengiriman email nonaktif (EMAIL_API_URL / EMAIL_API_KEY belum diisi) "
            "— email ke %s dilewati", to,
        )
        return None
    payload = {"to": [to], "subject": subject, "html": html,
               "from_name": config.EMAIL_FROM_NAME}
    try:
        async with httpx.AsyncClient(timeout=config.EMAIL_TIMEOUT_SECONDS) as ac:
            resp = await ac.post(
                config.EMAIL_API_URL,
                headers={config.EMAIL_API_KEY_HEADER: config.EMAIL_API_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        logger.error("Email send failed %s: %s", e.response.status_code, e.response.text)
    except Exception as e:
        logger.error("Email send error: %s", e)
    return None
