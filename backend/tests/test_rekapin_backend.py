"""Backend regression tests for Rekapin HR features (Jan 2026 iteration)."""
import io
import os
import pytest
import requests
from openpyxl import Workbook

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "wardah.nabilah97@gmail.com"
ADMIN_PASSWORD = "admin123"
WEBHOOK_SECRET = "wh_c9e3f7a4b1d8e6c2f5a9b0d3e7c1f8a2b6d4e0f9c5a1b8d2e6f4c0a7b3d9"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


created_ids = []


@pytest.fixture(scope="session", autouse=True)
def cleanup(token):
    yield
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}"})
    for cid in created_ids:
        try:
            s.delete(f"{API}/candidates/{cid}", timeout=15)
        except Exception:
            pass


# ---------- Auth ----------
def test_login_ok(token):
    assert token and isinstance(token, str)


def test_me(client):
    r = client.get(f"{API}/auth/me")
    assert r.status_code == 200
    assert r.json()["email"] == ADMIN_EMAIL


# ---------- Candidate CRUD w/ new fields ----------
def test_create_with_new_fields(client):
    payload = {
        "nama": "TEST_QA NewFields",
        "email": "qa_new@example.com",
        "pic": "PIC A",
        "pic_email": "pic@example.com",
        "status_tanda_tangan": "Belum",
        "tanggal_tanda_tangan": "",
        "tanggal_mulai_training": "",
    }
    r = client.post(f"{API}/candidates", json=payload)
    assert r.status_code == 200, r.text
    d = r.json()
    created_ids.append(d["id"])
    assert d["pic_email"] == "pic@example.com"
    assert d["status_tanda_tangan"] == "Belum"


# ---------- AUTO-RULE 1: training start date auto-populated ----------
def test_auto_populate_training_date(client):
    r = client.post(f"{API}/candidates", json={"nama": "TEST_QA AutoTrain", "status_training": "Belum Training"})
    assert r.status_code == 200
    cid = r.json()["id"]
    created_ids.append(cid)
    assert r.json().get("tanggal_mulai_training", "") == ""

    r2 = client.put(f"{API}/candidates/{cid}", json={"status_training": "Training"})
    assert r2.status_code == 200, r2.text
    updated = r2.json()
    assert updated["status_training"] == "Training"
    assert updated["tanggal_mulai_training"], "Expected auto-populated training start date"

    # GET verifies persistence
    r3 = client.get(f"{API}/candidates")
    row = next(c for c in r3.json() if c["id"] == cid)
    assert row["tanggal_mulai_training"] == updated["tanggal_mulai_training"]


# ---------- AUTO-RULE 2: TTD "Mengundurkan Setelah TTD" auto-blacklists ----------
def test_auto_blacklist_on_mengundurkan(client):
    r = client.post(f"{API}/candidates", json={"nama": "TEST_QA Mundur", "status_tanda_tangan": "Sudah"})
    cid = r.json()["id"]
    created_ids.append(cid)

    r2 = client.put(f"{API}/candidates/{cid}", json={"status_tanda_tangan": "Mengundurkan Setelah TTD"})
    assert r2.status_code == 200
    d = r2.json()
    assert d["status_blacklist"] == "Ya - Mengundurkan Setelah TTD"
    assert d["alasan_blacklist"], "Expected default alasan_blacklist to be populated"


# ---------- History ----------
def test_history_global_and_per_candidate(client):
    r = client.post(f"{API}/candidates", json={"nama": "TEST_QA HistoryTarget"})
    cid = r.json()["id"]
    created_ids.append(cid)
    client.put(f"{API}/candidates/{cid}", json={"pic": "PIC-Z"})

    g = client.get(f"{API}/candidates/history?limit=50")
    assert g.status_code == 200
    entries = g.json()
    assert any(e["candidate_id"] == cid for e in entries)

    p = client.get(f"{API}/candidates/{cid}/history")
    assert p.status_code == 200
    per = p.json()
    assert len(per) >= 2  # created + updated
    actions = {e["action"] for e in per}
    assert "created" in actions and "updated" in actions


# ---------- Excel upload ----------
def test_excel_upload(token):
    wb = Workbook()
    ws = wb.active
    ws.append(["nama", "email", "no_hp", "usia", "apply",
               "rencana_penempatan", "alamat", "pic", "pic_email", "keterangan"])
    ws.append(["TEST_QA Excel1", "e1@example.com", "081", 25, "Kasir",
               "Jakarta", "Jl A", "PIC1", "pic1@example.com", "n1"])
    ws.append(["TEST_QA Excel2", "e2@example.com", "082", 26, "Barista",
               "Bandung", "Jl B", "PIC2", "pic2@example.com", "n2"])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    r = requests.post(
        f"{API}/candidates/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("test.xlsx", buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    assert r.json()["inserted"] == 2

    # Verify persistence & schedule cleanup
    lst = requests.get(f"{API}/candidates", headers={"Authorization": f"Bearer {token}"}).json()
    for nm in ("TEST_QA Excel1", "TEST_QA Excel2"):
        row = next((c for c in lst if c["nama"] == nm), None)
        assert row is not None, f"{nm} not found"
        created_ids.append(row["id"])
        assert row["pic_email"].startswith("pic")


# ---------- Manual reminder ----------
def test_manual_reminder(client):
    r = client.post(f"{API}/candidates/training-reminder/run")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("queued") is True


# ---------- Cron endpoint auth ----------
def test_cron_requires_bearer():
    r = requests.post(f"{BASE_URL}/api/cron/training-reminder", timeout=15)
    assert r.status_code == 401


def test_cron_with_correct_secret():
    r = requests.post(
        f"{BASE_URL}/api/cron/training-reminder",
        headers={"Authorization": f"Bearer {WEBHOOK_SECRET}"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body == {"ok": True, "queued": True}


def test_cron_wrong_secret():
    r = requests.post(
        f"{BASE_URL}/api/cron/training-reminder",
        headers={"Authorization": "Bearer wrong"}, timeout=15,
    )
    assert r.status_code == 401


# ---------- Bulk paste regression ----------
def test_bulk_regression(client):
    r = client.post(f"{API}/candidates/bulk", json={
        "items": [
            {"nama": "TEST_QA Bulk A", "email": "ba@example.com"},
            {"nama": "TEST_QA Bulk B", "email": "bb@example.com"},
        ]
    })
    assert r.status_code == 200
    assert r.json()["inserted"] == 2
    lst = client.get(f"{API}/candidates").json()
    for nm in ("TEST_QA Bulk A", "TEST_QA Bulk B"):
        row = next((c for c in lst if c["nama"] == nm), None)
        assert row
        created_ids.append(row["id"])


# ---------- Export regression ----------
def test_export(client):
    r = client.get(f"{API}/candidates/export?scope=all")
    assert r.status_code == 200
    assert "spreadsheet" in r.headers.get("content-type", "")
