"""Pencatatan riwayat perubahan kandidat.

Label field diambil dari app/schema.py (FIELD_LABELS), jadi kolom baru
otomatis ikut tercatat tanpa mengubah file ini.
"""

import uuid
from typing import List

from ..db import db
from ..schema import FIELD_LABELS
from .common import now_iso


def _entry(candidate_id: str, candidate_nama: str, action: str,
           changes: List[dict], actor: dict, when: str) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "candidate_id": candidate_id,
        "candidate_nama": candidate_nama,
        "action": action,
        "changes": changes,
        "changed_at": when,
        "changed_by": actor.get("email") if actor else "system",
        "changed_by_name": actor.get("name") if actor else "System",
    }


async def log(candidate_id: str, candidate_nama: str, action: str,
              changes: List[dict], actor: dict) -> None:
    await db.candidate_history.insert_one(
        _entry(candidate_id, candidate_nama, action, changes, actor, now_iso())
    )


async def log_many(docs: List[dict], action: str, label: str, actor: dict, when: str) -> None:
    """Catat banyak kandidat sekaligus (import massal / upload Excel)."""
    if not docs:
        return
    entries = [
        _entry(d["id"], d["nama"], action,
               [{"field": f"_{action}", "label": label, "old": "", "new": d["nama"]}],
               actor, when)
        for d in docs
    ]
    await db.candidate_history.insert_many(entries)


def marker(field: str, label: str, old: str = "", new: str = "") -> List[dict]:
    """Satu entri perubahan non-field (dibuat, dihapus, email terkirim, dst)."""
    return [{"field": field, "label": label, "old": old, "new": new}]


def diff(old: dict, new: dict) -> List[dict]:
    """Bandingkan dua dokumen kandidat -> daftar perubahan siap dicatat."""
    changes = []
    for key, label in FIELD_LABELS.items():
        ov = old.get(key, "") if old else ""
        nv = new.get(key, "") if new else ""
        if (ov or "") != (nv or ""):
            changes.append({"field": key, "label": label, "old": ov, "new": nv})
    old_cd = (old or {}).get("custom_data") or {}
    new_cd = (new or {}).get("custom_data") or {}
    for k in set(list(old_cd.keys()) + list(new_cd.keys())):
        if (old_cd.get(k) or "") != (new_cd.get(k) or ""):
            changes.append({"field": f"custom.{k}", "label": k,
                            "old": old_cd.get(k, ""), "new": new_cd.get(k, "")})
    return changes
