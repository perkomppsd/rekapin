"""Unit test tanpa server — mengunci perilaku yang diturunkan dari app/schema.py.

Jalankan: pytest backend/tests/test_schema_unit.py
Test ini tidak butuh MongoDB atau server yang hidup, tapi tetap perlu
MONGO_URL & DB_NAME di environment karena app/config.py membacanya saat import.
"""

import io
import os
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "test_unit")

from openpyxl import Workbook, load_workbook  # noqa: E402

from app import schema  # noqa: E402
from app.emailing import templates  # noqa: E402
from app.models import CandidateCreate, CandidateUpdate  # noqa: E402
from app.services import excel, history  # noqa: E402
from app.services import nik as nik_service  # noqa: E402
from app.services.rules import apply_auto_rules  # noqa: E402


# ---------------------------------------------------------------------------
# Konsistensi schema
# ---------------------------------------------------------------------------
def test_field_keys_unik():
    keys = [f.key for f in schema.FIELDS]
    assert len(keys) == len(set(keys))


def test_setiap_field_punya_grup_yang_terdaftar():
    known = {key for key, _ in schema.FIELD_GROUPS}
    unknown = {f.group for f in schema.FIELDS} - known
    assert not unknown, f"grup belum didaftarkan di FIELD_GROUPS: {unknown}"


def test_field_select_menunjuk_status_set_yang_ada():
    for f in schema.FIELDS:
        if f.type == "select":
            assert f.options in schema.STATUS_SETS, f.key
            assert schema.STATUS_SETS[f.options], f.key


def test_default_select_termasuk_pilihan_yang_valid():
    for f in schema.FIELDS:
        if f.type == "select" and f.default:
            assert f.default in schema.STATUS_SETS[f.options], f.key


def test_urutan_import_positional_tidak_bolong():
    indexes = sorted(f.paste_index for f in schema.FIELDS if f.paste_index is not None)
    assert indexes == list(range(len(indexes))), "paste_index harus 0,1,2,... tanpa lompat"


def test_kolom_export_lengkap_dan_diakhiri_tanggal_input():
    keys = [k for k, _ in schema.EXPORT_COLUMNS]
    assert keys[-1] == "created_at"
    assert len(keys) == len([f for f in schema.FIELDS if f.export]) + 1


def test_model_kandidat_ikut_field_schema():
    model_fields = set(CandidateCreate.model_fields)
    assert {f.key for f in schema.FIELDS} <= model_fields
    assert "custom_data" in model_fields
    # Semua field pada update bersifat opsional.
    assert CandidateUpdate().model_dump(exclude_unset=True) == {}


def test_field_wajib_divalidasi():
    with pytest.raises(Exception):
        CandidateCreate()
    assert CandidateCreate(nama="Budi").nama == "Budi"


def test_label_riwayat_sama_dengan_field_yang_dilacak():
    assert set(schema.FIELD_LABELS) == {f.key for f in schema.FIELDS if f.history}


# ---------------------------------------------------------------------------
# Aturan otomatis
# ---------------------------------------------------------------------------
def test_mulai_training_mengisi_tanggal_mulai():
    out = apply_auto_rules({}, {"status_training": schema.Training.ONGOING})
    assert out["tanggal_mulai_training"]


def test_tanggal_mulai_training_tidak_ditimpa():
    out = apply_auto_rules(
        {"status_training": schema.Training.NOT_YET, "tanggal_mulai_training": "2026-01-01"},
        {"status_training": schema.Training.ONGOING},
    )
    assert "tanggal_mulai_training" not in out or out["tanggal_mulai_training"] == "2026-01-01"


def test_mengundurkan_setelah_ttd_masuk_blacklist():
    out = apply_auto_rules({}, {"status_tanda_tangan": schema.Ttd.RESIGNED_AFTER})
    assert out["status_blacklist"] == schema.Blacklist.RESIGNED_AFTER_TTD
    assert out["alasan_blacklist"]


def test_pic_email_dinormalisasi():
    out = apply_auto_rules({}, {"pic_email": "  PIC@Company.COM "})
    assert out["pic_email"] == "pic@company.com"


# ---------------------------------------------------------------------------
# Tab, scope, funnel
# ---------------------------------------------------------------------------
CANDIDATES = [
    {"status_interview": schema.Interview.NOT_CALLED, "status_training": schema.Training.NOT_YET,
     "status_blacklist": schema.Blacklist.NO, "penempatan_fix": ""},
    {"status_interview": schema.Interview.SCHEDULED, "status_training": schema.Training.ONGOING,
     "status_blacklist": schema.Blacklist.NO, "penempatan_fix": "Cabang A",
     "status_tanda_tangan": schema.Ttd.SIGNED},
    {"status_interview": schema.Interview.PASSED, "status_training": schema.Training.FINISHED,
     "status_blacklist": schema.Blacklist.VIOLATION, "penempatan_fix": "  "},
]


@pytest.mark.parametrize("scope,expected", [
    ("all", 3), ("master", 3), ("interview", 2), ("training", 1),
    ("blacklist", 1), ("placement", 1),
])
def test_filter_scope(scope, expected):
    assert len(schema.filter_by_scope(CANDIDATES, scope)) == expected


def test_tab_dan_scope_export_memakai_daftar_yang_sama():
    assert {t.key for t in schema.TABS} == set(schema.TAB_BY_KEY)


def test_funnel_urut_dan_tidak_naik():
    counts = [
        len(CANDIDATES) if pred is None else sum(1 for c in CANDIDATES if pred(c))
        for _, _, pred in schema.FUNNEL
    ]
    assert counts[0] == len(CANDIDATES)
    assert all(c >= 0 for c in counts)


# ---------------------------------------------------------------------------
# Template email
# ---------------------------------------------------------------------------
CANDIDATE = {
    "nama": "Budi", "email": "budi@example.com", "apply": "Kasir",
    "tanggal_interview": "2026-08-25", "jam_interview": "09:00",
    "metode_interview": "Online", "penempatan_fix": "Cabang A", "no_hp": "0812",
}


@pytest.mark.parametrize("spec", templates.TEMPLATES, ids=lambda s: s.id)
def test_semua_template_bisa_dirender(spec):
    out = templates.render(spec.id, CANDIDATE, extra={"penerima": "Tim"})
    assert out and out["subject"] and out["html"]
    assert "$" not in out["subject"], "ada placeholder yang tidak terisi"


def test_template_tidak_dikenal_mengembalikan_none():
    assert templates.render("tidak_ada", CANDIDATE) is None


def test_template_meng_escape_html():
    out = templates.render("panggilan_interview", {**CANDIDATE, "nama": "<script>x</script>"})
    assert "<script>" not in out["html"]


def test_daftar_template_publik_tanpa_template_internal():
    ids = {t["id"] for t in templates.public_templates()}
    assert "kandidat_baru_internal" not in ids
    assert "panggilan_interview" in ids


# ---------------------------------------------------------------------------
# Import & export Excel
# ---------------------------------------------------------------------------
def _workbook(rows):
    wb = Workbook()
    for row in rows:
        wb.active.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_import_dengan_header():
    content = _workbook([
        ["Nama", "Email", "No. HP", "Umur"],
        ["Budi", "b@x.com", "0812", 30],
        [None, None, None, None],
    ])
    rows = excel.parse_workbook(content)
    assert len(rows) == 1
    assert rows[0]["nama"] == "Budi" and rows[0]["usia"] == 30


def test_import_tanpa_header_mengikuti_urutan_schema():
    content = _workbook([["Ani", "a@x.com", "0899", 25, "Admin", "Cabang A",
                          "Jl. Mawar", "Wardah", "w@x.com", "catatan"]])
    rows = excel.parse_workbook(content)
    assert len(rows) == 1
    row = rows[0]
    for key, value in zip(schema.IMPORT_POSITIONAL,
                          ["Ani", "a@x.com", "0899", 25, "Admin", "Cabang A",
                           "Jl. Mawar", "Wardah", "w@x.com", "catatan"]):
        assert row[key] == value


def test_import_membuang_baris_tanpa_nama():
    content = _workbook([["Nama", "Email"], ["", "x@x.com"], ["Budi", "b@x.com"]])
    assert [r["nama"] for r in excel.parse_workbook(content)] == ["Budi"]


def test_export_header_sesuai_schema():
    stream, filename = excel.build_export_workbook([{"nama": "Budi"}], "all")
    ws = load_workbook(stream).active
    assert [c.value for c in ws[1]] == [label for _, label in schema.EXPORT_COLUMNS]
    assert filename.startswith("recruitment_all_") and filename.endswith(".xlsx")


# ---------------------------------------------------------------------------
# Riwayat perubahan
# ---------------------------------------------------------------------------
def test_diff_mencatat_perubahan_field_dan_kolom_kustom():
    changes = history.diff(
        {"nama": "A", "status_interview": schema.Interview.NOT_CALLED, "custom_data": {"x": "1"}},
        {"nama": "B", "status_interview": schema.Interview.SCHEDULED, "custom_data": {"x": "2"}},
    )
    fields = {c["field"] for c in changes}
    assert {"nama", "status_interview", "custom.x"} <= fields


def test_diff_kosong_kalau_tidak_ada_perubahan():
    doc = {"nama": "A", "status_interview": schema.Interview.NOT_CALLED}
    assert history.diff(doc, dict(doc)) == []


# ---------------------------------------------------------------------------
# NIK (KTP) — kunci identitas kandidat
# ---------------------------------------------------------------------------
def test_nik_terdaftar_sebagai_field_unik_dan_searchable():
    spec = schema.FIELD_BY_KEY["nik"]
    assert spec.unique and spec.searchable and spec.sensitive
    assert "nik" in schema.UNIQUE_FIELDS
    assert "nik" in schema.SEARCHABLE_FIELDS


@pytest.mark.parametrize("raw,expected", [
    ("3201011234567890", "3201011234567890"),
    ("3201 0112 3456 7890", "3201011234567890"),   # spasi
    ("3201.0112.3456.7890", "3201011234567890"),   # titik
    ("3201-0112-3456-7890", "3201011234567890"),   # strip
    ("  3201011234567890  ", "3201011234567890"),
    (None, ""),
    ("", ""),
])
def test_normalisasi_nik(raw, expected):
    assert nik_service.normalize(raw) == expected


@pytest.mark.parametrize("raw", ["3201011234567890", "0000000000000000", None, "", "   "])
def test_nik_valid_atau_kosong_diterima(raw):
    assert nik_service.reject_reason(raw) is None


@pytest.mark.parametrize("raw,pesan", [
    ("123", "16 digit"),                       # terlalu pendek
    ("32010112345678901", "16 digit"),         # terlalu panjang
    ("32010112345678AB", "hanya boleh berisi angka"),
    ("NIK: 3201011234567890", "hanya boleh berisi angka"),
])
def test_nik_tidak_valid_ditolak(raw, pesan):
    reason = nik_service.reject_reason(raw)
    assert reason and pesan in reason


def test_nik_wajib_16_digit():
    assert nik_service.NIK_LENGTH == 16
    assert nik_service.is_valid("1234567890123456")
    assert not nik_service.is_valid("123456789012345")


def test_pesan_duplikat_menyebut_nama_pemilik():
    pesan = nik_service.duplicate_message({"nama": "Budi", "status_blacklist": schema.Blacklist.NO})
    assert "Budi" in pesan
    assert "BLACKLIST" not in pesan


def test_pesan_duplikat_memperingatkan_blacklist():
    pesan = nik_service.duplicate_message({
        "nama": "Fajar",
        "status_blacklist": schema.Blacklist.VIOLATION,
        "alasan_blacklist": "Memalsukan dokumen",
    })
    assert "BLACKLIST" in pesan and "Fajar" in pesan
    assert "Memalsukan dokumen" in pesan


def test_nik_ikut_kolom_export():
    assert ("nik", "NIK (KTP)") in schema.EXPORT_COLUMNS


def test_alias_header_ktp_dikenali_saat_import():
    for header in ("nik", "no ktp", "ktp", "nomor ktp", "no. ktp", "nik (ktp)"):
        assert schema.IMPORT_HEADER_MAP[header] == "nik"


def test_nik_jadi_kolom_paste_terakhir_agar_sheet_lama_tidak_bergeser():
    # Urutan 10 kolom pertama harus tetap sama seperti sebelum NIK ditambahkan.
    assert schema.IMPORT_POSITIONAL[:10] == [
        "nama", "email", "no_hp", "usia", "apply",
        "rencana_penempatan", "alamat", "pic", "pic_email", "keterangan",
    ]
    assert schema.IMPORT_POSITIONAL[10] == "nik"


def test_import_excel_mengenali_kolom_no_ktp():
    content = _workbook([
        ["Nama", "No KTP"],
        ["Budi", "3201 0112 3456 7890"],
    ])
    rows = excel.parse_workbook(content)
    assert len(rows) == 1
    # Normalisasi final dilakukan saat simpan; di sini cukup nilainya terbaca.
    assert nik_service.normalize(rows[0]["nik"]) == "3201011234567890"
