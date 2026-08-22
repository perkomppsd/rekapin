"""Aturan otomatis saat kandidat dibuat/diubah.

Cara menambah aturan baru: tambah satu `Rule` di daftar `RULES`.
  when  -> fungsi (before, incoming) yang mengembalikan True kalau aturan berlaku
  then  -> fungsi (before, incoming) yang mengembalikan dict perubahan tambahan

Cara menambah normalisasi nilai: tambah entri di `NORMALIZERS`.
"""

from dataclasses import dataclass
from typing import Callable, Dict, Tuple

from ..schema import Blacklist, Kontrak, Training, Ttd
from .. import config
from .common import add_days, birthdate_from_nik, today_str


# ---------- Helper untuk menulis kondisi ----------
def value_of(before: dict, incoming: dict, key: str, default: str = "") -> object:
    """Nilai efektif sebuah field setelah update diterapkan."""
    if key in incoming:
        return incoming.get(key)
    return (before or {}).get(key, default)


def became(before: dict, incoming: dict, key: str, value: str) -> bool:
    """True kalau field berubah MENJADI `value` (sebelumnya bukan)."""
    return value_of(before, incoming, key) == value and (before or {}).get(key) != value


def still_empty(before: dict, incoming: dict, key: str) -> bool:
    return not incoming.get(key) and not (before or {}).get(key)


@dataclass(frozen=True)
class Rule:
    name: str
    when: Callable[[dict, dict], bool]
    then: Callable[[dict, dict], Dict[str, object]]


RULES: Tuple[Rule, ...] = (
    Rule(
        name="Tanggal lahir kosong -> ambil dari NIK",
        when=lambda b, i: (
            still_empty(b, i, "tanggal_lahir")
            and bool(birthdate_from_nik(value_of(b, i, "nik")))
        ),
        then=lambda b, i: {"tanggal_lahir": birthdate_from_nik(value_of(b, i, "nik"))},
    ),
    Rule(
        name="Mulai training -> isi tanggal mulai otomatis",
        when=lambda b, i: became(b, i, "status_training", Training.ONGOING),
        then=lambda b, i: (
            {"tanggal_mulai_training": today_str()}
            if still_empty(b, i, "tanggal_mulai_training") else {}
        ),
    ),
    Rule(
        name="TTD kontrak selesai -> isi tanggal TTD kontrak otomatis",
        when=lambda b, i: became(b, i, "status_kontrak", Kontrak.SIGNED),
        then=lambda b, i: (
            {"tanggal_ttd_kontrak": today_str()}
            if still_empty(b, i, "tanggal_ttd_kontrak") else {}
        ),
    ),
    Rule(
        name="TTD kontrak terisi -> hitung tanggal habis kontrak (6 bulan)",
        when=lambda b, i: bool(value_of(b, i, "tanggal_ttd_kontrak")),
        then=lambda b, i: (
            {"tanggal_habis_kontrak":
                add_days(value_of(b, i, "tanggal_ttd_kontrak"), config.CONTRACT_PERIOD_DAYS)}
            if still_empty(b, i, "tanggal_habis_kontrak") else {}
        ),
    ),
    Rule(
        name="Mengundurkan setelah kontrak -> masuk blacklist",
        when=lambda b, i: value_of(b, i, "status_kontrak") == Kontrak.RESIGNED_AFTER,
        then=lambda b, i: {
            "status_blacklist": Blacklist.RESIGNED_AFTER_KONTRAK,
            **({"alasan_blacklist":
                "Kandidat mengundurkan diri setelah menandatangani kontrak kerja."}
               if still_empty(b, i, "alasan_blacklist") else {}),
        },
    ),
    Rule(
        name="Mengundurkan setelah TTD -> masuk blacklist",
        when=lambda b, i: value_of(b, i, "status_tanda_tangan") == Ttd.RESIGNED_AFTER,
        then=lambda b, i: {
            "status_blacklist": Blacklist.RESIGNED_AFTER_TTD,
            **({"alasan_blacklist":
                "Kandidat mengundurkan diri setelah menandatangani kesepakatan."}
               if still_empty(b, i, "alasan_blacklist") else {}),
        },
    ),
)


# Normalisasi nilai sebelum disimpan. pic_email dipakai untuk filter hak akses,
# jadi harus selalu lowercase.
NORMALIZERS: Dict[str, Callable[[object], object]] = {
    "pic_email": lambda v: v.strip().lower() if isinstance(v, str) else v,
    "email": lambda v: v.strip() if isinstance(v, str) else v,
}


def apply_auto_rules(before: dict, incoming: dict) -> dict:
    """Terapkan semua RULES + NORMALIZERS ke dict update. Mengubah `incoming`."""
    for rule in RULES:
        if rule.when(before, incoming):
            incoming.update(rule.then(before, incoming))
    for key, normalize in NORMALIZERS.items():
        if key in incoming:
            incoming[key] = normalize(incoming[key])
    return incoming
