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
    ("candidates", "apply", False),
    ("candidates", "status_interview", False),
    ("candidates", "status_training", False),
    ("candidates", "status_blacklist", False),
    ("candidates", "created_by", False),
    ("candidate_history", "candidate_id", False),
    ("candidate_history", "changed_at", False),
    ("custom_fields", "key", True),
)


async def ensure_indexes() -> None:
    for collection, field, unique in INDEXES:
        await db[collection].create_index(field, unique=unique)

    # Field unik dari schema.py (mis. NIK). Pakai PARTIAL index supaya kandidat
    # yang field-nya masih kosong tidak saling bentrok — hanya nilai non-kosong
    # yang wajib unik.
    for field in UNIQUE_FIELDS:
        await db.candidates.create_index(
            field,
            unique=True,
            partialFilterExpression={field: {"$gt": ""}},
            name=f"{field}_unique_nonempty",
        )


def close() -> None:
    client.close()
