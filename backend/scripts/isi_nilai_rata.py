"""Hitung ulang rata-rata nilai untuk semua kandidat.

Rata-rata disimpan di field `nilai_rata` supaya kolom Nilai bisa diurutkan oleh
database. Data yang tersimpan sebelum field ini ada perlu dihitung sekali:

    cd backend && .venv/bin/python scripts/isi_nilai_rata.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import client, db                              # noqa: E402
from app.schema import RATING_AVG_FIELD, rating_average    # noqa: E402


async def main() -> None:
    docs = await db.candidates.find({}, {"_id": 0}).to_list(100000)
    diubah = 0
    for c in docs:
        rata = rating_average(c)
        if c.get(RATING_AVG_FIELD) != rata:
            await db.candidates.update_one({"id": c["id"]}, {"$set": {RATING_AVG_FIELD: rata}})
            diubah += 1
    print(f"{len(docs)} kandidat diperiksa, {diubah} diperbarui.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    finally:
        client.close()
