"""SUMBER TUNGGAL definisi data kandidat.

File ini adalah tempat utama yang perlu diubah kalau ada permintaan baru:

  * Tambah kolom kandidat  -> tambah satu `FieldSpec` di `FIELDS`.
  * Tambah pilihan status   -> tambah string di `STATUS_SETS` (+ konstanta jika
                               statusnya dipakai oleh logika, lihat kelas di bawah).
  * Tambah tab / scope      -> tambah satu `StageSpec` di `TABS`.
  * Ubah tahapan funnel     -> ubah `FUNNEL`.

Semua turunan dibuat otomatis dari deklarasi di sini:
  - Model Pydantic (app/models.py)
  - Label riwayat perubahan (FIELD_LABELS)
  - Kolom export Excel (EXPORT_COLUMNS)
  - Pemetaan header import Excel / paste (IMPORT_HEADER_MAP, IMPORT_POSITIONAL)
  - Metadata untuk frontend (GET /api/meta)
"""

import re
from dataclasses import dataclass, field as dc_field
from typing import Any, Callable, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Tipe kolom yang didukung
# ---------------------------------------------------------------------------
# text | email | textarea | number | date | time | select | rating
PY_TYPE_OF = {
    "number": int,
    "rating": int,
}  # sisanya -> str


@dataclass(frozen=True)
class FieldSpec:
    key: str                                  # nama field di DB & API
    label: str                                # label bahasa Indonesia (UI, riwayat, export)
    type: str = "text"                        # lihat daftar tipe di atas
    group: str = "lain"                        # grup form di frontend
    default: Any = ""                          # nilai default saat kandidat dibuat
    options: Optional[str] = None              # nama set pilihan tetap di STATUS_SETS
    options_ref: Optional[str] = None          # nama daftar referensi (dikelola admin)
    options_source: Optional[str] = None       # sumber pilihan dinamis lain ("users")
    required: bool = False
    placeholder: str = ""
    hint: str = ""                             # teks bantuan di form
    span: int = 1                              # 1 = setengah baris, 2 = full width
    export: bool = True                        # ikut di file export Excel
    export_label: Optional[str] = None         # override header export (default: label upper)
    history: bool = True                       # ikut dicatat di riwayat perubahan
    aliases: Tuple[str, ...] = ()              # header alternatif saat import Excel
    paste_index: Optional[int] = None          # urutan kolom untuk import tanpa header
    searchable: bool = False                   # ikut dicari oleh kotak pencarian
    unique: bool = False                       # tidak boleh ada dua kandidat dengan nilai sama
    sensitive: bool = False                    # data pribadi sensitif (jangan masuk email)

    @property
    def py_type(self) -> type:
        return PY_TYPE_OF.get(self.type, str)


# ---------------------------------------------------------------------------
# Pilihan status. Urutan di sini = urutan di dropdown frontend.
# ---------------------------------------------------------------------------
class Interview:
    NOT_CALLED = "Belum Dipanggil"
    CALLED = "Sudah Dipanggil"
    SCHEDULED = "Terjadwal"
    DONE = "Selesai Interview"
    PASSED = "Lulus Interview"
    FAILED = "Tidak Lulus"


class Ttd:
    PENDING = "Belum"
    SIGNED = "Sudah"
    RESIGNED_AFTER = "Mengundurkan Setelah TTD"


class Kontrak:
    """TTD kontrak kerja, ditandatangani setelah masa awal (default 6 bulan)."""
    PENDING = "Belum"
    SIGNED = "Sudah"
    EXTENDED = "Diperpanjang"
    NOT_CONTINUED = "Tidak Dilanjutkan"
    RESIGNED_AFTER = "Mengundurkan Setelah Kontrak"


class Training:
    NOT_YET = "Belum Training"
    ONGOING = "Training"
    PASSED = "Lulus Training"
    FAILED = "Tidak Lulus Training"
    FINISHED = "Selesai (3 Bulan)"


class Blacklist:
    NO = "Tidak"
    YES_PREFIX = "Ya"                            # semua status blacklist diawali "Ya"
    RESIGNED = "Ya - Mengundurkan Diri"
    RESIGNED_AFTER_TTD = "Ya - Mengundurkan Setelah TTD"
    RESIGNED_AFTER_KONTRAK = "Ya - Mengundurkan Setelah Kontrak"
    NO_SHOW = "Ya - Tidak Hadir"
    VIOLATION = "Ya - Pelanggaran"
    OTHER = "Ya - Lainnya"


STATUS_SETS: Dict[str, List[str]] = {
    "interview": [Interview.NOT_CALLED, Interview.CALLED, Interview.SCHEDULED,
                  Interview.DONE, Interview.PASSED, Interview.FAILED],
    "metode": ["Online", "Offline", "Telepon"],
    "ttd": [Ttd.PENDING, Ttd.SIGNED, Ttd.RESIGNED_AFTER],
    "kontrak": [Kontrak.PENDING, Kontrak.SIGNED, Kontrak.EXTENDED,
                Kontrak.NOT_CONTINUED, Kontrak.RESIGNED_AFTER],
    "training": [Training.NOT_YET, Training.ONGOING, Training.PASSED,
                 Training.FAILED, Training.FINISHED],
    "blacklist": [Blacklist.NO, Blacklist.RESIGNED, Blacklist.RESIGNED_AFTER_TTD,
                  Blacklist.RESIGNED_AFTER_KONTRAK, Blacklist.NO_SHOW,
                  Blacklist.VIOLATION, Blacklist.OTHER],
    "role": ["admin", "recruiter"],
}

# ---------------------------------------------------------------------------
# Daftar referensi — isinya DIKELOLA ADMIN dari halaman Setting, bukan hardcode.
#
# Menambah daftar baru:
#   1. Tambah satu entri di REFERENCE_LISTS.
#   2. Tunjuk daftar itu dari FieldSpec lewat `options_ref="nama_daftar"`.
# Endpoint CRUD, dropdown di form, dan halaman Setting ikut otomatis.
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class ReferenceList:
    key: str
    label: str                       # judul di halaman Setting
    singular: str                    # kata tunggal untuk pesan ("Unit usaha")
    description: str
    fields: Tuple[str, ...]          # field kandidat yang memakai daftar ini
    note_label: str = "Keterangan"   # judul kolom keterangan pada item


REFERENCE_LISTS: Dict[str, "ReferenceList"] = {
    "unit_usaha": ReferenceList(
        key="unit_usaha",
        label="Unit Usaha",
        singular="Unit usaha",
        description="Daftar unit usaha / cabang tempat kandidat ditempatkan.",
        fields=("rencana_penempatan", "penempatan_fix"),
        note_label="Lokasi / Catatan",
    ),
    "jobdesk": ReferenceList(
        key="jobdesk",
        label="Jobdesk",
        singular="Jobdesk",
        description="Daftar posisi beserta uraian tugasnya.",
        fields=("apply", "posisi_penempatan", "posisi_fix"),
        note_label="Uraian Tugas",
    ),
}


def reference_list_for(field_key: str) -> Optional[ReferenceList]:
    for ref in REFERENCE_LISTS.values():
        if field_key in ref.fields:
            return ref
    return None


# Status interview yang memicu email undangan interview otomatis.
INTERVIEW_INVITE_STATUSES = (Interview.SCHEDULED, Interview.CALLED)


# ---------------------------------------------------------------------------
# Definisi kolom kandidat. URUTAN DI SINI = urutan kolom file export.
# ---------------------------------------------------------------------------
FIELDS: Tuple[FieldSpec, ...] = (
    # --- Data pribadi ---
    FieldSpec("nama", "Nama", group="pribadi", required=True, searchable=True,
              aliases=("name",), paste_index=0),
    # NIK = kunci identitas kandidat. Unik, jadi orang yang sama tidak bisa
    # masuk dua kali dan riwayat blacklist-nya ikut terbawa saat melamar lagi.
    # paste_index diletakkan paling akhir supaya sheet paste yang sudah ada
    # (10 kolom) tidak bergeser — NIK jadi kolom ke-11 yang opsional.
    FieldSpec("nik", "NIK (KTP)", group="pribadi", required=True, searchable=True,
              unique=True, sensitive=True, placeholder="16 digit angka",
              hint="Wajib. Belum punya NIK? Pakai tombol di sebelah untuk NIK sementara",
              aliases=("no ktp", "ktp", "nomor ktp", "no. ktp", "nomor induk kependudukan"),
              paste_index=10),
    FieldSpec("email", "Email", type="email", group="pribadi", searchable=True,
              aliases=("email address",), paste_index=1),
    FieldSpec("alamat", "Alamat", type="textarea", group="pribadi", span=2,
              aliases=("address",), paste_index=6),
    FieldSpec("no_hp", "No HP", group="pribadi", searchable=True,
              aliases=("no hp", "no. hp", "phone", "telepon"), paste_index=2),
    # Tanggal lahir menggantikan kolom "usia": umur dihitung otomatis supaya
    # tidak pernah basi. Bisa terisi sendiri dari NIK (digit 7-12 = DDMMYY).
    FieldSpec("tanggal_lahir", "Tanggal Lahir", type="date", group="pribadi",
              hint="Umur dihitung otomatis. Terisi sendiri dari NIK kalau kosong",
              aliases=("tgl lahir", "birth date", "dob", "tanggal_lahir"),
              paste_index=3),
    FieldSpec("apply", "Apply", type="select", group="pribadi", searchable=True,
              options_ref="jobdesk", placeholder="Posisi yang dilamar",
              aliases=("posisi apply", "posisi"), paste_index=4),

    # --- Penempatan ---
    FieldSpec("rencana_penempatan", "Rencana Penempatan", type="select",
              group="penempatan", options_ref="unit_usaha", paste_index=5),
    FieldSpec("posisi_penempatan", "Posisi Penempatan", type="select",
              group="penempatan", options_ref="jobdesk"),
    FieldSpec("penempatan_fix", "Penempatan Fix", type="select", group="penempatan",
              options_ref="unit_usaha", placeholder="Unit usaha / cabang"),
    FieldSpec("posisi_fix", "Posisi Fix", type="select", group="penempatan",
              options_ref="jobdesk"),

    # --- Interview ---
    FieldSpec("status_interview", "Status Interview", type="select", group="interview",
              options="interview", default=Interview.NOT_CALLED),
    FieldSpec("tanggal_interview", "Tanggal Interview", type="date", group="interview"),
    FieldSpec("jam_interview", "Jam Interview", type="time", group="interview"),
    FieldSpec("metode_interview", "Metode Interview", type="select", group="interview",
              options="metode"),

    # --- Tanda tangan kesepakatan ---
    FieldSpec("status_tanda_tangan", "Status TTD Kesepakatan", type="select", group="ttd",
              options="ttd", default=Ttd.PENDING, export_label="STATUS TTD KESEPAKATAN",
              aliases=("status ttd", "status tanda tangan")),
    FieldSpec("tanggal_tanda_tangan", "Tanggal TTD Kesepakatan", type="date", group="ttd",
              export_label="TANGGAL TTD KESEPAKATAN",
              aliases=("tanggal ttd", "tanggal tanda tangan")),

    # --- TTD kontrak kerja (setelah masa awal, default 6 bulan) ---
    FieldSpec("status_kontrak", "Status TTD Kontrak", type="select", group="kontrak",
              options="kontrak", default=Kontrak.PENDING,
              export_label="STATUS TTD KONTRAK", aliases=("status kontrak",)),
    FieldSpec("tanggal_ttd_kontrak", "Tanggal TTD Kontrak", type="date", group="kontrak",
              hint="Terisi otomatis saat status jadi Sudah",
              aliases=("tanggal kontrak", "tgl ttd kontrak")),
    FieldSpec("tanggal_habis_kontrak", "Tanggal Habis Kontrak", type="date", group="kontrak",
              hint="Terisi otomatis 6 bulan setelah TTD kontrak; dipakai reminder",
              aliases=("habis kontrak", "kontrak berakhir")),

    # --- Training ---
    FieldSpec("status_training", "Status Training", type="select", group="training",
              options="training", default=Training.NOT_YET),
    FieldSpec("tanggal_mulai_training", "Tanggal Mulai Training", type="date",
              group="training", hint="Terisi otomatis saat status jadi Training",
              export_label="MULAI TRAINING"),

    # --- Blacklist ---
    FieldSpec("status_blacklist", "Status Blacklist", type="select", group="blacklist",
              options="blacklist", default=Blacklist.NO),
    FieldSpec("alasan_blacklist", "Alasan Blacklist", type="textarea", group="blacklist",
              span=2),

    # --- Penilaian (bintang 1-5, 0 = belum dinilai) ---
    FieldSpec("nilai_wajah", "Nilai Wajah", type="rating", group="penilaian", default=0),
    FieldSpec("nilai_komunikasi", "Nilai Komunikasi", type="rating", group="penilaian", default=0),
    FieldSpec("nilai_kedisiplinan", "Nilai Kedisiplinan", type="rating", group="penilaian", default=0),

    # --- Catatan & PIC ---
    FieldSpec("keterangan", "Keterangan", type="textarea", group="catatan", span=2,
              aliases=("catatan", "notes"), paste_index=9),
    # PIC dipilih dari daftar user, bukan diketik: email-nya menentukan hak akses,
    # jadi satu typo bikin recruiter kehilangan akses tanpa pesan error.
    FieldSpec("pic", "PIC", type="select", group="pribadi", searchable=True,
              options_source="users", paste_index=7),
    FieldSpec("pic_email", "Email PIC", type="email", group="pribadi",
              placeholder="terisi otomatis dari PIC",
              hint="Menentukan hak akses & penerima reminder — ikut PIC yang dipilih",
              aliases=("email pic", "pic email"), paste_index=8),
)

FIELD_BY_KEY: Dict[str, FieldSpec] = {f.key: f for f in FIELDS}

# Grup form beserta judulnya (urutan = urutan section di form frontend).
FIELD_GROUPS: Tuple[Tuple[str, str], ...] = (
    ("pribadi", "Data Pribadi"),
    ("penilaian", "Penilaian Kandidat"),
    ("penempatan", "Penempatan"),
    ("interview", "Interview"),
    ("ttd", "TTD Kesepakatan"),
    ("training", "Training (3 Bulan)"),
    ("kontrak", "TTD Kontrak (6 Bulan)"),
    ("blacklist", "Blacklist"),
    ("catatan", "Catatan"),
)

# Field sistem (diisi server, tidak bisa di-input user).
SYSTEM_FIELDS: Tuple[Tuple[str, str], ...] = (
    ("created_at", "Tanggal Input"),
    ("updated_at", "Terakhir Diubah"),
    ("created_by", "Dibuat Oleh (ID)"),
    ("created_by_email", "Dibuat Oleh"),
)


# ---------------------------------------------------------------------------
# Turunan: label riwayat, kolom export, pemetaan import
# ---------------------------------------------------------------------------
FIELD_LABELS: Dict[str, str] = {f.key: f.label for f in FIELDS if f.history}

# Field yang ikut dicari kotak pencarian di dashboard.
SEARCHABLE_FIELDS: List[str] = [f.key for f in FIELDS if f.searchable]

# Field yang nilainya harus unik antar kandidat (dibuatkan unique index di db.py).
UNIQUE_FIELDS: List[str] = [f.key for f in FIELDS if f.unique]

EXPORT_COLUMNS: List[Tuple[str, str]] = [
    (f.key, f.export_label or f.label.upper()) for f in FIELDS if f.export
] + [("created_at", "TANGGAL INPUT")]


def _import_header_map() -> Dict[str, str]:
    """Header Excel (lowercase) -> key field. Key & label ikut otomatis."""
    mapping: Dict[str, str] = {}
    for f in FIELDS:
        for candidate in (f.key, f.key.replace("_", " "), f.label.lower(), *f.aliases):
            mapping.setdefault(candidate.strip().lower(), f.key)
    return mapping


IMPORT_HEADER_MAP: Dict[str, str] = _import_header_map()

# Urutan kolom untuk import tanpa header (upload .xlsx & paste TSV/CSV).
IMPORT_POSITIONAL: List[str] = [
    f.key for f in sorted(
        (f for f in FIELDS if f.paste_index is not None),
        key=lambda f: f.paste_index,
    )
]

DEFAULT_CANDIDATE: Dict[str, Any] = {f.key: f.default for f in FIELDS}


# ---------------------------------------------------------------------------
# Predikat tahapan — dipakai tab dashboard, statistik, export scope, funnel
# ---------------------------------------------------------------------------
def _norm(value: Any) -> str:
    return (value or "").strip().lower()


def in_interview(c: dict) -> bool:
    return _norm(c.get("status_interview")) not in ("", _norm(Interview.NOT_CALLED))


def in_training(c: dict, include_finished: bool = False) -> bool:
    allowed = [Training.ONGOING, Training.PASSED]
    if include_finished:
        allowed.append(Training.FINISHED)
    return _norm(c.get("status_training")) in [_norm(s) for s in allowed]


def is_blacklisted(c: dict) -> bool:
    return _norm(c.get("status_blacklist")).startswith(_norm(Blacklist.YES_PREFIX))


def is_placed(c: dict) -> bool:
    return bool((c.get("penempatan_fix") or "").strip())


def has_signed(c: dict) -> bool:
    return _norm(c.get("status_tanda_tangan")) == _norm(Ttd.SIGNED)


def has_contract(c: dict) -> bool:
    """Sudah menandatangani kontrak kerja (termasuk yang diperpanjang)."""
    return _norm(c.get("status_kontrak")) in (
        _norm(Kontrak.SIGNED), _norm(Kontrak.EXTENDED),
    )


@dataclass(frozen=True)
class StageSpec:
    key: str                                  # id tab & nilai ?scope= pada export
    label: str
    predicate: Optional[Callable[[dict], bool]] = None   # None = semua kandidat
    icon: str = "ClipboardList"                # nama ikon lucide di frontend
    tone: str = "indigo"                       # warna kartu statistik
    stat: bool = True                          # tampil sebagai kartu statistik
    stat_label: Optional[str] = None           # judul kartu statistik (default: label)
    # Padanan `predicate` dalam bahasa query MongoDB, supaya filter & hitungan
    # dikerjakan database (tidak perlu menarik semua dokumen).
    # WAJIB setara dengan predicate — dijaga test di tests/test_schema_unit.py.
    query: Optional[dict] = None

    def matches(self, c: dict) -> bool:
        return True if self.predicate is None else self.predicate(c)


# Tab dashboard + scope export. Tambah satu entri = tab baru muncul otomatis.
# Query Mongo untuk tiap tahap. `_ci` = pencocokan tanpa peduli huruf besar/kecil.
def _ci_in(field: str, values: List[str]) -> dict:
    return {field: {"$in": [re.compile(f"^{re.escape(v)}$", re.I) for v in values]}}


_NOT_STARTED_INTERVIEW = ["", Interview.NOT_CALLED]
Q_IN_INTERVIEW = {"$nor": [
    {"status_interview": {"$exists": False}},
    _ci_in("status_interview", _NOT_STARTED_INTERVIEW),
]}
Q_IN_TRAINING = _ci_in("status_training", [Training.ONGOING, Training.PASSED])
Q_IN_TRAINING_ANY = _ci_in("status_training",
                           [Training.ONGOING, Training.PASSED, Training.FINISHED])
Q_BLACKLISTED = {"status_blacklist": re.compile(f"^{re.escape(Blacklist.YES_PREFIX)}", re.I)}
Q_PLACED = {"penempatan_fix": {"$exists": True, "$regex": r"\S"}}
Q_SIGNED = _ci_in("status_tanda_tangan", [Ttd.SIGNED])
Q_HAS_CONTRACT = _ci_in("status_kontrak", [Kontrak.SIGNED, Kontrak.EXTENDED])

TABS: Tuple[StageSpec, ...] = (
    StageSpec("master", "Master Data", None, "ClipboardList", "indigo",
              stat_label="Total Kandidat"),
    StageSpec("interview", "Interview", in_interview, "Users", "amber",
              query=Q_IN_INTERVIEW),
    StageSpec("training", "Training", in_training, "GraduationCap", "sky",
              query=Q_IN_TRAINING),
    StageSpec("blacklist", "Blacklist", is_blacklisted, "Ban", "rose",
              query=Q_BLACKLISTED),
    StageSpec("placement", "Placement", is_placed, "MapPin", "emerald",
              query=Q_PLACED),
    StageSpec("kontrak", "TTD Kontrak", has_contract, "FileSignature", "violet",
              query=Q_HAS_CONTRACT),
)


def stage_query(scope: str) -> dict:
    """Query Mongo untuk sebuah tab. Tab tak dikenal / master -> semua kandidat."""
    stage = TAB_BY_KEY.get(scope)
    return dict(stage.query) if stage and stage.query else {}

TAB_BY_KEY: Dict[str, StageSpec] = {t.key: t for t in TABS}

# Tahapan funnel (urut). `conversion` dihitung terhadap tahap sebelumnya.
# (key, label, predicate Python, query Mongo)
FUNNEL: Tuple[Tuple[str, str, Optional[Callable[[dict], bool]], Optional[dict]], ...] = (
    ("apply", "Apply", None, None),
    ("interview", "Interview", in_interview, Q_IN_INTERVIEW),
    ("ttd", "TTD Kesepakatan", has_signed, Q_SIGNED),
    # Funnel menghitung yang sudah selesai training juga (beda dengan tab Training).
    ("training", "Training", lambda c: in_training(c, include_finished=True), Q_IN_TRAINING_ANY),
    ("placement", "Placement", is_placed, Q_PLACED),
    ("kontrak", "TTD Kontrak", has_contract, Q_HAS_CONTRACT),
)


def filter_by_scope(items: List[dict], scope: str) -> List[dict]:
    """Filter daftar kandidat sesuai tab/scope. Scope tak dikenal -> semua."""
    stage = TAB_BY_KEY.get(scope)
    if stage is None or stage.predicate is None:
        return list(items)
    return [d for d in items if stage.predicate(d)]
