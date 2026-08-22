"""Isi daftar referensi (Unit Usaha & Jobdesk) dari data kandidat yang sudah ada.

Sebelum daftar ini ada, kolom penempatan & posisi diisi teks bebas. Script ini
mengumpulkan semua nilai yang sudah dipakai, lalu memasukkannya ke daftar
supaya nilai lama tetap muncul di dropdown dan tidak ada data yang "yatim".

    cd backend && .venv/bin/python scripts/isi_daftar_referensi.py           # dry run
    cd backend && .venv/bin/python scripts/isi_daftar_referensi.py --tulis   # simpan
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import client, db                    # noqa: E402
from app.schema import REFERENCE_LISTS           # noqa: E402
from app.services import references              # noqa: E402


async def main(tulis: bool) -> None:
    total = 0
    for key, ref in REFERENCE_LISTS.items():
        sudah = set(await references.names(key))
        ditemukan: dict = {}
        for field in ref.fields:
            for nilai in await db.candidates.distinct(field):
                if isinstance(nilai, str) and nilai.strip():
                    ditemukan.setdefault(nilai.strip(), set()).add(field)

        baru = {n: f for n, f in ditemukan.items() if n not in sudah}
        print(f"\n{ref.label}: {len(sudah)} sudah ada, {len(baru)} akan ditambahkan")
        for nama, fields in sorted(baru.items()):
            print(f"  + {nama:<28} (dari: {', '.join(sorted(fields))})")
            if tulis:
                await references.create(key, nama, "")
        total += len(baru)

    if not tulis:
        print(f"\n[dry run] {total} item akan ditambahkan. "
              f"Jalankan ulang dengan --tulis untuk menyimpan.")
    else:
        print(f"\nSelesai. {total} item ditambahkan.")


if __name__ == "__main__":
    try:
        asyncio.run(main("--tulis" in sys.argv))
    finally:
        client.close()
