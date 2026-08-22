"""Import & export Excel.

Kolom export dan pemetaan header import diambil dari app/schema.py
(EXPORT_COLUMNS, IMPORT_HEADER_MAP, IMPORT_POSITIONAL) — jadi kolom baru
otomatis ikut tanpa mengubah file ini.
"""

import io
from datetime import datetime
from typing import Iterable, List, Optional, Tuple

from openpyxl import Workbook, load_workbook

from ..schema import EXPORT_COLUMNS, IMPORT_HEADER_MAP, IMPORT_POSITIONAL, TAB_BY_KEY
from .candidates import coerce_value, from_import_row
from .common import age_from

# Kolom hasil hitungan (tidak disimpan di database): (key, judul, cara hitung)
COMPUTED_COLUMNS = (
    # Umur dihitung dari tanggal lahir. Kalau kandidat lama belum punya tanggal
    # lahir, pakai nilai "usia" yang tersimpan sebelum kolom ini ada.
    ("usia", "USIA", lambda d: age_from(d.get("tanggal_lahir")) or d.get("usia") or ""),
)


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------
def build_export_workbook(docs: Iterable[dict], scope: str) -> Tuple[io.BytesIO, str]:
    """Return (stream xlsx, nama file)."""
    wb = Workbook()
    ws = wb.active
    stage = TAB_BY_KEY.get(scope)
    ws.title = (stage.label.upper() if stage and stage.predicate else "MASTER DATA")[:31]
    ws.append([label for _, label in EXPORT_COLUMNS]
              + [label for _, label, _fn in COMPUTED_COLUMNS])
    for d in docs:
        ws.append([d.get(key, "") for key, _ in EXPORT_COLUMNS]
                  + [fn(d) for _key, _label, fn in COMPUTED_COLUMNS])

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    filename = f"recruitment_{scope}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return stream, filename


# ---------------------------------------------------------------------------
# Import
# ---------------------------------------------------------------------------
# Minimal jumlah sel baris pertama yang harus dikenali agar dianggap header.
# 2 (bukan 1) supaya baris data yang kebetulan berisi kata seperti "catatan"
# tidak salah dibaca sebagai header.
MIN_HEADER_MATCHES = 2


def _column_fields(header: List[str]) -> Optional[List[Optional[str]]]:
    """Petakan header sheet -> daftar key field. None kalau header tak dikenali."""
    matches = sum(1 for h in header if h in IMPORT_HEADER_MAP)
    if matches < MIN_HEADER_MATCHES:
        return None
    return [IMPORT_HEADER_MAP.get(h) for h in header]


def parse_workbook(content: bytes) -> List[dict]:
    """Baca file .xlsx -> daftar dict kandidat yang valid.

    Baris pertama dipakai sebagai header kalau dikenali; kalau tidak, kolom
    dibaca berurutan sesuai IMPORT_POSITIONAL di schema.py.
    """
    wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active

    rows_iter = ws.iter_rows(values_only=True)
    try:
        first = next(rows_iter)
    except StopIteration:
        return []

    header = [str(c).strip().lower() if c is not None else "" for c in first]
    col_fields = _column_fields(header)
    if col_fields is None:
        # Tidak ada header -> baca semua baris termasuk baris pertama.
        rows_iter = ws.iter_rows(values_only=True)
        col_fields = list(IMPORT_POSITIONAL)

    out: List[dict] = []
    for row in rows_iter:
        if not row or all(c is None or str(c).strip() == "" for c in row):
            continue
        values = {}
        for idx, raw in enumerate(row):
            if idx >= len(col_fields):
                break
            key = col_fields[idx]
            if not key or raw is None:
                continue
            value = coerce_value(key, raw)
            if value is not None:
                values[key] = value
        doc = from_import_row(values)
        if doc is not None:
            out.append(doc)
    return out
