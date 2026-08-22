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
    options: Optional[str] = None              # nama set pilihan di STATUS_SETS
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
    NO_SHOW = "Ya - Tidak Hadir"
    VIOLATION = "Ya - Pelanggaran"
    OTHER = "Ya - Lainnya"


STATUS_SETS: Dict[str, List[str]] = {
    "interview": [Interview.NOT_CALLED, Interview.CALLED, Interview.SCHEDULED,
                  Interview.DONE, Interview.PASSED, Interview.FAILED],
    "metode": ["Online", "Offline", "Telepon"],
    "ttd": [Ttd.PENDING, Ttd.SIGNED, Ttd.RESIGNED_AFTER],
    "training": [Training.NOT_YET, Training.ONGOING, Training.PASSED,
                 Training.FAILED, Training.FINISHED],
    "blacklist": [Blacklist.NO, Blacklist.RESIGNED, Blacklist.RESIGNED_AFTER_TTD,
                  Blacklist.NO_SHOW, Blacklist.VIOLATION, Blacklist.OTHER],
    "role": ["admin", "recruiter"],
}

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
    FieldSpec("nik", "NIK (KTP)", group="pribadi", searchable=True, unique=True,
              sensitive=True, placeholder="16 digit angka",
              hint="Dipakai untuk mencegah data ganda & cek blacklist",
              aliases=("no ktp", "ktp", "nomor ktp", "no. ktp", "nomor induk kependudukan"),
              paste_index=10),
    FieldSpec("email", "Email", type="email", group="pribadi", searchable=True,
              aliases=("email address",), paste_index=1),
    FieldSpec("alamat", "Alamat", type="textarea", group="pribadi", span=2,
              aliases=("address",), paste_index=6),
    FieldSpec("no_hp", "No HP", group="pribadi", searchable=True,
              aliases=("no hp", "no. hp", "phone", "telepon"), paste_index=2),
    FieldSpec("usia", "Usia", type="number", group="pribadi", default=None,
              aliases=("umur", "age"), paste_index=3),
    FieldSpec("apply", "Apply", group="pribadi", searchable=True,
              placeholder="Posisi yang dilamar",
              aliases=("posisi apply", "posisi"), paste_index=4),

    # --- Penempatan ---
    FieldSpec("rencana_penempatan", "Rencana Penempatan", group="penempatan",
              paste_index=5),
    FieldSpec("posisi_penempatan", "Posisi Penempatan", group="penempatan"),
    FieldSpec("penempatan_fix", "Penempatan Fix", group="penempatan",
              placeholder="Cabang / Lokasi"),
    FieldSpec("posisi_fix", "Posisi Fix", group="penempatan"),

    # --- Interview ---
    FieldSpec("status_interview", "Status Interview", type="select", group="interview",
              options="interview", default=Interview.NOT_CALLED),
    FieldSpec("tanggal_interview", "Tanggal Interview", type="date", group="interview"),
    FieldSpec("jam_interview", "Jam Interview", type="time", group="interview"),
    FieldSpec("metode_interview", "Metode Interview", type="select", group="interview",
              options="metode"),

    # --- Tanda tangan kesepakatan ---
    FieldSpec("status_tanda_tangan", "Status Tanda Tangan", type="select", group="ttd",
              options="ttd", default=Ttd.PENDING, export_label="STATUS TTD"),
    FieldSpec("tanggal_tanda_tangan", "Tanggal Tanda Tangan", type="date", group="ttd",
              export_label="TANGGAL TTD"),

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
    FieldSpec("pic", "PIC", group="pribadi", searchable=True, paste_index=7),
    FieldSpec("pic_email", "Email PIC", type="email", group="pribadi",
              placeholder="pic@company.com", hint="Dipakai untuk reminder & hak akses",
              aliases=("email pic", "pic email"), paste_index=8),
)

FIELD_BY_KEY: Dict[str, FieldSpec] = {f.key: f for f in FIELDS}

# Grup form beserta judulnya (urutan = urutan section di form frontend).
FIELD_GROUPS: Tuple[Tuple[str, str], ...] = (
    ("pribadi", "Data Pribadi"),
    ("penilaian", "Penilaian Kandidat"),
    ("penempatan", "Penempatan"),
    ("interview", "Interview"),
    ("ttd", "Tanda Tangan Kesepakatan"),
    ("training", "Training (3 Bulan)"),
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


@dataclass(frozen=True)
class StageSpec:
    key: str                                  # id tab & nilai ?scope= pada export
    label: str
    predicate: Optional[Callable[[dict], bool]] = None   # None = semua kandidat
    icon: str = "ClipboardList"                # nama ikon lucide di frontend
    tone: str = "indigo"                       # warna kartu statistik
    stat: bool = True                          # tampil sebagai kartu statistik
    stat_label: Optional[str] = None           # judul kartu statistik (default: label)

    def matches(self, c: dict) -> bool:
        return True if self.predicate is None else self.predicate(c)


# Tab dashboard + scope export. Tambah satu entri = tab baru muncul otomatis.
TABS: Tuple[StageSpec, ...] = (
    StageSpec("master", "Master Data", None, "ClipboardList", "indigo",
              stat_label="Total Kandidat"),
    StageSpec("interview", "Interview", in_interview, "Users", "amber"),
    StageSpec("training", "Training", in_training, "GraduationCap", "sky"),
    StageSpec("blacklist", "Blacklist", is_blacklisted, "Ban", "rose"),
    StageSpec("placement", "Placement", is_placed, "MapPin", "emerald"),
)

TAB_BY_KEY: Dict[str, StageSpec] = {t.key: t for t in TABS}

# Tahapan funnel (urut). `conversion` dihitung terhadap tahap sebelumnya.
FUNNEL: Tuple[Tuple[str, str, Optional[Callable[[dict], bool]]], ...] = (
    ("apply", "Apply", None),
    ("interview", "Interview", in_interview),
    ("ttd", "Tanda Tangan", has_signed),
    # Funnel menghitung yang sudah selesai training juga (beda dengan tab Training).
    ("training", "Training", lambda c: in_training(c, include_finished=True)),
    ("placement", "Placement", is_placed),
)


def filter_by_scope(items: List[dict], scope: str) -> List[dict]:
    """Filter daftar kandidat sesuai tab/scope. Scope tak dikenal -> semua."""
    stage = TAB_BY_KEY.get(scope)
    if stage is None or stage.predicate is None:
        return list(items)
    return [d for d in items if stage.predicate(d)]
