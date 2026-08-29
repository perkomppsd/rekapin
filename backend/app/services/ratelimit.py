"""Pembatas laju sederhana untuk endpoint publik (anti-spam).

Catatan jujur soal keterbatasannya:
  * Hitungannya disimpan di memori proses. Kalau backend dijalankan lebih dari
    satu proses/worker, tiap proses punya hitungan sendiri.
  * Hitungannya hilang saat server restart.
Untuk portal lowongan skala satu perusahaan ini memadai. Kalau nanti dijalankan
multi-worker atau butuh perlindungan lebih kuat, ganti dengan Redis atau
pembatas di level reverse proxy / Cloudflare.
"""

import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import HTTPException, Request

_hits: Dict[str, Deque[float]] = defaultdict(deque)


def client_ip(request: Request) -> str:
    # Di belakang reverse proxy, IP asli ada di X-Forwarded-For.
    fwd = request.headers.get("X-Forwarded-For", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check(request: Request, *, limit: int, window_minutes: int) -> None:
    """Raise 429 kalau IP ini sudah melewati batas dalam rentang waktu."""
    now = time.monotonic()
    window = window_minutes * 60
    antrian = _hits[client_ip(request)]
    while antrian and now - antrian[0] > window:
        antrian.popleft()
    if len(antrian) >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"Terlalu banyak lamaran dari perangkat ini. "
                   f"Coba lagi dalam {window_minutes} menit.",
        )
    antrian.append(now)


def reset() -> None:
    """Hanya untuk test."""
    _hits.clear()
