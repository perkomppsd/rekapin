"""Isi tanggal lahir kandidat lama dari NIK-nya.

NIK memuat tanggal lahir di digit 7-12 (DDMMYY, perempuan DD+40), jadi data
lama bisa dilengkapi tanpa mengetik ulang. Jalankan sekali:

    cd backend && .venv/bin/python scripts/isi_tanggal_lahir.py

Yang DILEWATI (tidak diisi asal):
  - kandidat yang tanggal lahirnya sudah ada
  - NIK sementara (awalan 9999)
  - NIK yang menghasilkan tanggal tidak wajar (umur di luar 15-70 tahun)

Tambahkan argumen --tulis untuk benar-benar menyimpan; tanpa itu hanya
menampilkan rencana perubahan (dry run).
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import client, db                          # noqa: E402
from app.services.common import age_from, birthdate_from_nik  # noqa: E402


async def main(tulis: bool) -> None:
    docs = await db.candidates.find(
        {"$or": [{"tanggal_lahir": {"$exists": False}}, {"tanggal_lahir": ""},
                 {"tanggal_lahir": None}]},
        {"_id": 0, "id": 1, "nama": 1, "nik": 1, "usia": 1},
    ).to_list(100000)

    terisi, dilewati = [], []
    for c in docs:
        lahir = birthdate_from_nik(c.get("nik", ""))
        (terisi if lahir else dilewati).append((c, lahir))

    print(f"{len(docs)} kandidat tanpa tanggal lahir\n")
    for c, lahir in terisi:
        print(f"  ISI     {c.get('nama', '')[:28]:<28} NIK {c.get('nik', '')} -> "
              f"{lahir} (umur {age_from(lahir)})")
    for c, _ in dilewati:
        alasan = "NIK sementara" if str(c.get("nik", "")).startswith("9999") else "NIK tidak memuat tanggal wajar"
        print(f"  LEWATI  {c.get('nama', '')[:28]:<28} {alasan}")

    if not tulis:
        print(f"\n[dry run] {len(terisi)} akan diisi, {len(dilewati)} dilewati.")
        print("Jalankan ulang dengan --tulis untuk menyimpan.")
        return

    for c, lahir in terisi:
        await db.candidates.update_one({"id": c["id"]}, {"$set": {"tanggal_lahir": lahir}})
    print(f"\nSelesai. {len(terisi)} kandidat diisi tanggal lahirnya.")


if __name__ == "__main__":
    try:
        asyncio.run(main("--tulis" in sys.argv))
    finally:
        client.close()
