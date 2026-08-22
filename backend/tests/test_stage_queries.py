"""Penjaga duplikasi aturan tahapan.

Setiap tab/tahap punya DUA definisi: `predicate` (Python, dipakai export & job)
dan `query` (MongoDB, dipakai listing & hitungan). Kalau keduanya tidak sepadan,
angka di dashboard akan beda dengan isi tabel — bug yang sulit dilacak.

Test ini menjalankan keduanya atas kumpulan data yang sama dan memastikan
hasilnya identik. Butuh MongoDB lokal; kalau tidak ada, test di-skip.
"""

import os
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "test_unit")

from app import schema  # noqa: E402

pymongo = pytest.importorskip("pymongo")

# Data uji yang sengaja menyentuh kasus pinggir: huruf besar/kecil beda, field
# tidak ada, string kosong, dan spasi saja.
SAMPLES = [
    {"id": "1", "nama": "Belum diproses", "status_interview": "Belum Dipanggil",
     "status_training": "Belum Training", "status_blacklist": "Tidak", "penempatan_fix": ""},
    {"id": "2", "nama": "Terjadwal", "status_interview": "Terjadwal",
     "status_training": "Belum Training", "status_blacklist": "Tidak", "penempatan_fix": "  "},
    {"id": "3", "nama": "Training jalan", "status_interview": "Lulus Interview",
     "status_training": "Training", "status_tanda_tangan": "Sudah",
     "status_blacklist": "Tidak", "penempatan_fix": "Cabang A"},
    {"id": "4", "nama": "Lulus training", "status_interview": "Lulus Interview",
     "status_training": "Lulus Training", "status_tanda_tangan": "Sudah",
     "status_blacklist": "Tidak", "penempatan_fix": "Cabang B"},
    {"id": "5", "nama": "Selesai 3 bulan", "status_interview": "Lulus Interview",
     "status_training": "Selesai (3 Bulan)", "status_tanda_tangan": "sudah",
     "status_blacklist": "tidak", "penempatan_fix": "Cabang C"},
    {"id": "6", "nama": "Blacklist", "status_interview": "Lulus Interview",
     "status_training": "Belum Training", "status_blacklist": "Ya - Pelanggaran",
     "penempatan_fix": ""},
    {"id": "7", "nama": "Huruf kecil semua", "status_interview": "terjadwal",
     "status_training": "training", "status_blacklist": "ya - lainnya",
     "penempatan_fix": "cabang d"},
    {"id": "8", "nama": "Field tidak ada"},
    {"id": "9", "nama": "Status kosong", "status_interview": "",
     "status_training": "", "status_blacklist": "", "penempatan_fix": ""},
]


@pytest.fixture(scope="module")
def collection():
    client = pymongo.MongoClient(os.environ["MONGO_URL"], serverSelectionTimeoutMS=1500)
    try:
        client.admin.command("ping")
    except Exception:
        pytest.skip("MongoDB tidak tersedia — test kesepadanan query di-skip")
    col = client["test_stage_queries"]["candidates"]
    col.drop()
    col.insert_many([dict(d) for d in SAMPLES])
    yield col
    col.database.client.drop_database("test_stage_queries")
    client.close()


def _by_predicate(predicate):
    return sorted(d["id"] for d in SAMPLES if predicate(d))


def _by_query(collection, query):
    return sorted(d["id"] for d in collection.find(query or {}, {"id": 1, "_id": 0}))


@pytest.mark.parametrize("tab", [t for t in schema.TABS if t.predicate], ids=lambda t: t.key)
def test_query_tab_sepadan_dengan_predicate(collection, tab):
    assert tab.query is not None, f"tab '{tab.key}' punya predicate tapi belum punya query Mongo"
    assert _by_query(collection, tab.query) == _by_predicate(tab.predicate), (
        f"tab '{tab.key}': hasil query Mongo beda dengan predicate Python"
    )


@pytest.mark.parametrize("stage", [s for s in schema.FUNNEL if s[2]], ids=lambda s: s[0])
def test_query_funnel_sepadan_dengan_predicate(collection, stage):
    key, _label, predicate, query = stage
    assert query is not None, f"tahap funnel '{key}' belum punya query Mongo"
    assert _by_query(collection, query) == _by_predicate(predicate), (
        f"tahap funnel '{key}': hasil query Mongo beda dengan predicate Python"
    )


def test_tab_master_mengambil_semua(collection):
    assert schema.stage_query("master") == {}
    assert len(_by_query(collection, schema.stage_query("master"))) == len(SAMPLES)
