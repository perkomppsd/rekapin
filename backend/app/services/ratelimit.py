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


def _antrian(request: Request, namespace: str, window_minutes: int):
    """Antrian waktu percobaan untuk (namespace, IP), sudah dibersihkan."""
    now = time.monotonic()
    antrian = _hits[f"{namespace}:{client_ip(request)}"]
    while antrian and now - antrian[0] > window_minutes * 60:
        antrian.popleft()
    return antrian, now


def ensure(request: Request, *, namespace: str, limit: int, window_minutes: int,
           pesan: str) -> None:
    """Raise 429 kalau sudah melewati batas — TANPA menambah hitungan."""
    antrian, _ = _antrian(request, namespace, window_minutes)
    if len(antrian) >= limit:
        raise HTTPException(status_code=429, detail=pesan)


def record(request: Request, *, namespace: str, window_minutes: int) -> None:
    """Catat satu percobaan."""
    antrian, now = _antrian(request, namespace, window_minutes)
    antrian.append(now)


def check(request: Request, *, limit: int, window_minutes: int,
          namespace: str = "publik", pesan: str = "") -> None:
    """Cek sekaligus catat (dipakai endpoint yang setiap panggilannya dihitung)."""
    ensure(request, namespace=namespace, limit=limit, window_minutes=window_minutes,
           pesan=pesan or (f"Terlalu banyak permintaan dari perangkat ini. "
                           f"Coba lagi dalam {window_minutes} menit."))
    record(request, namespace=namespace, window_minutes=window_minutes)


def reset() -> None:
    """Hanya untuk test."""
    _hits.clear()
