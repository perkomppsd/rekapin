"""Koneksi MongoDB + index.

Tambah index biasa: tambahkan satu baris di INDEXES.
Index unik untuk field kandidat: cukup set `unique=True` pada FieldSpec di
app/schema.py — index-nya dibuat otomatis di sini.
"""

from motor.motor_asyncio import AsyncIOMotorClient

from . import config
from .schema import UNIQUE_FIELDS

client = AsyncIOMotorClient(config.MONGO_URL)
db = client[config.DB_NAME]

# (nama_koleksi, field, unique)
INDEXES = (
    ("users", "email", True),
    ("candidates", "nama", False),
    ("candidates", "created_at", False),
    ("candidates", "nilai_rata", False),
    ("candidates", "apply", False),
    ("candidates", "status_interview", False),
    ("candidates", "status_training", False),
    ("candidates", "status_blacklist", False),
    ("candidates", "created_by", False),
    ("candidate_history", "candidate_id", False),
    ("candidate_history", "changed_at", False),
    ("custom_fields", "key", True),
    ("reference_items", "list", False),
    ("job_postings", "slug", True),
    ("job_postings", "status", False),
    ("applications", "status", False),
    ("applications", "created_at", False),
    ("applications", "nik", False),
    ("files", "id", True),
)


async def ensure_indexes() -> None:
    for collection, field, unique in INDEXES:
        await db[collection].create_index(field, unique=unique)

    # Field unik dari schema.py (mis. NIK). Pakai PARTIAL index supaya kandidat
    # yang field-nya masih kosong tidak saling bentrok — hanya nilai non-kosong
    # yang wajib unik.
    # Nama item daftar referensi unik per daftar (Unit Usaha & Jobdesk boleh
    # punya nama sama, tapi tidak boleh dobel di dalam daftar yang sama).
    await db.reference_items.create_index(
        [("list", 1), ("nama", 1)], unique=True, name="reference_list_nama_unique",
    )

    for field in UNIQUE_FIELDS:
        await db.candidates.create_index(
            field,
            unique=True,
            partialFilterExpression={field: {"$gt": ""}},
            name=f"{field}_unique_nonempty",
        )


def close() -> None:
    client.close()
