"""Backend tests for Rekapin Jan 2026 v5 features:
Funnel, Users CRUD, Custom Fields, Ratings, Tenancy, Auto-email, Date filter, Send-email."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "wardah.nabilah97@gmail.com"
ADMIN_PASSWORD = "admin123"

RECRUITER_EMAIL = "test.pic@example.com"
RECRUITER_PASSWORD = "pic12345"


# ---------- Session fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"})
    return s


# Track created for cleanup
created_users = []
created_candidates = []
created_custom_fields = []


@pytest.fixture(scope="session", autouse=True)
def cleanup(admin_token):
    yield
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}"})
    for cid in created_candidates:
        try: s.delete(f"{API}/candidates/{cid}", timeout=15)
        except Exception: pass
    for uid in created_users:
        try: s.delete(f"{API}/users/{uid}", timeout=15)
        except Exception: pass
    for fid in created_custom_fields:
        try: s.delete(f"{API}/custom-fields/{fid}", timeout=15)
        except Exception: pass


# ---------- Funnel ----------
def test_funnel_five_stages(admin):
    r = admin.get(f"{API}/candidates/funnel")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "stages" in data
    stages = data["stages"]
    assert len(stages) == 5
    labels = [s["label"] for s in stages]
    assert labels == ["Apply", "Interview", "Tanda Tangan", "Training", "Placement"]
    for s in stages:
        assert "count" in s and "conversion" in s and "dropoff" in s


# ---------- Users CRUD ----------
def test_admin_user_crud_and_recruiter_403(admin):
    # create recruiter
    payload = {"email": RECRUITER_EMAIL, "name": "Test PIC", "password": RECRUITER_PASSWORD, "role": "recruiter"}
    # Clean up any leftover first
    lst = admin.get(f"{API}/users").json()
    for u in lst:
        if u["email"] == RECRUITER_EMAIL:
            admin.delete(f"{API}/users/{u['id']}")
    r = admin.post(f"{API}/users", json=payload)
    assert r.status_code == 200, r.text
    u = r.json()
    assert u["role"] == "recruiter"
    assert u["email"] == RECRUITER_EMAIL
    created_users.append(u["id"])

    # list
    lst = admin.get(f"{API}/users").json()
    assert any(x["email"] == RECRUITER_EMAIL for x in lst)

    # login as recruiter
    lr = requests.post(f"{API}/auth/login", json={"email": RECRUITER_EMAIL, "password": RECRUITER_PASSWORD})
    assert lr.status_code == 200, lr.text
    rtok = lr.json()["access_token"]

    # recruiter cannot list users
    fr = requests.get(f"{API}/users", headers={"Authorization": f"Bearer {rtok}"})
    assert fr.status_code == 403


# ---------- Custom Fields ----------
def test_custom_fields_crud(admin):
    payload = {"label": "TEST_QA CFSelect", "type": "select", "options": ["A", "B", "C"]}
    r = admin.post(f"{API}/custom-fields", json=payload)
    assert r.status_code == 200, r.text
    cf = r.json()
    created_custom_fields.append(cf["id"])
    assert cf["type"] == "select"
    assert cf["options"] == ["A", "B", "C"]
    assert cf["key"]  # slugified

    # invalid type
    r2 = admin.post(f"{API}/custom-fields", json={"label": "bad", "type": "date"})
    assert r2.status_code == 400

    # list visible to any auth user
    r3 = admin.get(f"{API}/custom-fields")
    assert r3.status_code == 200
    assert any(x["id"] == cf["id"] for x in r3.json())


# ---------- Candidate with ratings + custom_data ----------
def test_candidate_with_ratings_and_custom_data(admin):
    # First create a custom field
    cf = admin.post(f"{API}/custom-fields", json={"label": "TEST_QA Sumber", "type": "text"}).json()
    created_custom_fields.append(cf["id"])
    key = cf["key"]

    payload = {
        "nama": "TEST_QA Ratings",
        "email": "cand.rating@example.com",
        "alamat": "Jl Mawar 1",
        "nilai_wajah": 4, "nilai_komunikasi": 5, "nilai_kedisiplinan": 3,
        "custom_data": {key: "Instagram"},
    }
    r = admin.post(f"{API}/candidates", json=payload)
    assert r.status_code == 200, r.text
    d = r.json()
    created_candidates.append(d["id"])
    assert d["nilai_wajah"] == 4
    assert d["nilai_komunikasi"] == 5
    assert d["nilai_kedisiplinan"] == 3
    assert d["alamat"] == "Jl Mawar 1"
    assert d.get("custom_data", {}).get(key) == "Instagram"

    # verify persistence
    g = admin.get(f"{API}/candidates").json()
    row = next(x for x in g if x["id"] == d["id"])
    assert row["custom_data"][key] == "Instagram"


# ---------- Date filter ----------
def test_date_filter(admin):
    # Get today's candidates count should include the ones we just made
    from datetime import date
    today = date.today().strftime("%Y-%m-%d")
    r = admin.get(f"{API}/candidates?date_from={today}&date_to={today}")
    assert r.status_code == 200
    # far future range → empty
    r2 = admin.get(f"{API}/candidates?date_from=2099-01-01&date_to=2099-01-02")
    assert r2.status_code == 200
    assert r2.json() == []


# ---------- Send email ----------
def test_send_email_template(admin):
    r = admin.post(f"{API}/candidates", json={
        "nama": "TEST_QA EmailTgt", "email": "target@example.com",
        "apply": "Kasir", "tanggal_interview": "2026-02-01",
    })
    cid = r.json()["id"]
    created_candidates.append(cid)

    r2 = admin.post(f"{API}/candidates/{cid}/send-email", json={"template": "panggilan_interview"})
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body["ok"] is True
    assert "email_id" in body

    # bad template
    r3 = admin.post(f"{API}/candidates/{cid}/send-email", json={"template": "nonexistent"})
    assert r3.status_code == 400

    # missing candidate email → 400
    r4 = admin.post(f"{API}/candidates", json={"nama": "TEST_QA NoEmail"})
    ncid = r4.json()["id"]
    created_candidates.append(ncid)
    r5 = admin.post(f"{API}/candidates/{ncid}/send-email", json={"template": "reminder"})
    assert r5.status_code == 400


# ---------- Auto-email on status change (200 OK is enough) ----------
def test_auto_email_status_transition(admin):
    r = admin.post(f"{API}/candidates", json={"nama": "TEST_QA AutoEmail", "email": "auto@example.com"})
    cid = r.json()["id"]
    created_candidates.append(cid)
    r2 = admin.put(f"{API}/candidates/{cid}", json={"status_interview": "Terjadwal",
                                                     "tanggal_interview": "2026-02-05"})
    assert r2.status_code == 200


# ---------- Auto-notify Hasan (200 OK is enough) ----------
def test_auto_notify_hasan_on_placement(admin):
    r = admin.post(f"{API}/candidates", json={"nama": "TEST_QA HasanFix"})
    cid = r.json()["id"]
    created_candidates.append(cid)
    r2 = admin.put(f"{API}/candidates/{cid}", json={"penempatan_fix": "Jakarta - Kasir"})
    assert r2.status_code == 200
    assert r2.json()["penempatan_fix"] == "Jakarta - Kasir"


def test_auto_notify_hasan_on_ttd_sudah(admin):
    r = admin.post(f"{API}/candidates", json={"nama": "TEST_QA HasanTTD"})
    cid = r.json()["id"]
    created_candidates.append(cid)
    r2 = admin.put(f"{API}/candidates/{cid}", json={"status_tanda_tangan": "Sudah"})
    assert r2.status_code == 200


# ---------- Tenancy ----------
def test_tenancy_recruiter_isolation(admin):
    # ensure recruiter exists
    lst = admin.get(f"{API}/users").json()
    ru = next((u for u in lst if u["email"] == RECRUITER_EMAIL), None)
    if not ru:
        cr = admin.post(f"{API}/users", json={"email": RECRUITER_EMAIL, "name": "Test PIC",
                                              "password": RECRUITER_PASSWORD, "role": "recruiter"})
        assert cr.status_code == 200
        ru = cr.json()
        created_users.append(ru["id"])

    # login as recruiter
    lr = requests.post(f"{API}/auth/login", json={"email": RECRUITER_EMAIL, "password": RECRUITER_PASSWORD})
    rtok = lr.json()["access_token"]
    rsess = requests.Session()
    rsess.headers.update({"Authorization": f"Bearer {rtok}", "Content-Type": "application/json"})

    # admin creates a candidate NOT owned by recruiter, and pic_email different
    a1 = admin.post(f"{API}/candidates", json={"nama": "TEST_QA AdminOwned",
                                                "pic_email": "other@x.com"}).json()
    created_candidates.append(a1["id"])

    # admin creates a candidate whose pic_email == recruiter email → recruiter should see
    a2 = admin.post(f"{API}/candidates", json={"nama": "TEST_QA PicOwned",
                                                "pic_email": RECRUITER_EMAIL}).json()
    created_candidates.append(a2["id"])

    # recruiter creates their own
    r3 = rsess.post(f"{API}/candidates", json={"nama": "TEST_QA RecruiterOwned"})
    assert r3.status_code == 200
    r3d = r3.json()
    created_candidates.append(r3d["id"])

    # recruiter list
    lst_r = rsess.get(f"{API}/candidates").json()
    ids = {c["id"] for c in lst_r}
    assert a1["id"] not in ids, "Recruiter should NOT see admin-owned candidate with other pic"
    assert a2["id"] in ids, "Recruiter should see pic-owned candidate"
    assert r3d["id"] in ids, "Recruiter should see own"

    # admin sees all
    lst_a = admin.get(f"{API}/candidates").json()
    ids_a = {c["id"] for c in lst_a}
    assert a1["id"] in ids_a and a2["id"] in ids_a and r3d["id"] in ids_a
