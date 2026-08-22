"""Beri NIK sementara ke kandidat lama yang belum punya NIK.

NIK sekarang wajib, tapi data yang sudah tersimpan sebelum aturan itu berlaku
bisa saja kosong. Jalankan sekali:

    cd backend && .venv/bin/python scripts/isi_nik_sementara.py

Kandidat yang diberi NIK sementara ditandai awalan 9999 dan tampil dengan label
"sementara" di tabel, jadi mudah ditindaklanjuti kalau KTP-nya sudah terkumpul.
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import client, db          # noqa: E402
from app.services import nik as nik_service  # noqa: E402


async def main() -> None:
    kosong = await db.candidates.find(
        {"$or": [{"nik": {"$exists": False}}, {"nik": ""}, {"nik": None}]},
        {"_id": 0, "id": 1, "nama": 1},
    ).to_list(100000)

    if not kosong:
        print("Semua kandidat sudah punya NIK. Tidak ada yang diubah.")
        return

    print(f"{len(kosong)} kandidat tanpa NIK ditemukan:")
    for c in kosong:
        nik = await nik_service.generate_temporary()
        await db.candidates.update_one({"id": c["id"]}, {"$set": {"nik": nik}})
        print(f"  {c.get('nama', '(tanpa nama)'):<30} -> {nik}")
    print(f"\nSelesai. {len(kosong)} kandidat diberi NIK sementara.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    finally:
        client.close()
