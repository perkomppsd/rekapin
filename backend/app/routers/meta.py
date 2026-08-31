"""GET /api/meta — mengirim definisi skema ke frontend.

Berkat endpoint ini frontend tidak perlu menyalin daftar field/status/tab.
Ubah app/schema.py, dan form, tabel, filter, serta dropdown email di frontend
ikut berubah tanpa edit kode frontend.
"""

from fastapi import APIRouter, Depends

from .. import schema
from ..db import db
from ..services import nik as nik_service, references
from ..emailing import templates
from ..security import get_current_user

router = APIRouter(tags=["meta"])


def _field_payload(f: schema.FieldSpec, ref_values: dict) -> dict:
    return {
        "key": f.key,
        "label": f.label,
        "type": f.type,
        "group": f.group,
        "default": f.default,
        "options": (list(schema.STATUS_SETS.get(f.options, [])) if f.options
                    else ref_values.get(f.options_ref or f.options_source)
                    if (f.options_ref or f.options_source) else None),
        "options_ref": f.options_ref,
        "options_source": f.options_source,
        "required": f.required,
        "placeholder": f.placeholder,
        "hint": f.hint,
        "span": f.span,
        "searchable": f.searchable,
        "sensitive": f.sensitive,
    }


async def _user_options() -> list:
    docs = await db.users.find({}, {"_id": 0, "name": 1, "email": 1}).sort(
        "name", 1).to_list(500)
    return [{"nama": d.get("name", ""), "email": d.get("email", "")}
            for d in docs if d.get("name")]


async def build_meta() -> dict:
    # Pilihan untuk field ber-`options_ref` diambil dari daftar yang dikelola admin.
    ref_values = await references.all_names()
    users = await _user_options()
    ref_values["users"] = [u["nama"] for u in users]
    return {
        "fields": [_field_payload(f, ref_values) for f in schema.FIELDS],
        "user_options": users,
        "reference_lists": [
            {"key": r.key, "label": r.label, "singular": r.singular,
             "description": r.description, "fields": list(r.fields),
             "note_label": r.note_label}
            for r in schema.REFERENCE_LISTS.values()
        ],
        "groups": [{"key": k, "label": label} for k, label in schema.FIELD_GROUPS],
        "statuses": schema.STATUS_SETS,
        "tabs": [{"key": t.key, "label": t.label, "icon": t.icon, "tone": t.tone,
                   "stat": t.stat, "stat_label": t.stat_label or t.label}
                  for t in schema.TABS],
        "funnel": [{"key": k, "label": label} for k, label, _p, _q in schema.FUNNEL],
        "email_templates": await templates.get_all_templates(),
        "import_columns": [
            {"key": key, "label": schema.FIELD_BY_KEY[key].label}
            for key in schema.IMPORT_POSITIONAL
        ],
        "system_fields": [{"key": k, "label": label} for k, label in schema.SYSTEM_FIELDS],
        "searchable_fields": schema.SEARCHABLE_FIELDS,
        "sorts": [{"key": s.key, "label": s.label} for s in schema.SORTS.values()],
        "default_sort": schema.DEFAULT_SORT,
        "nik_temp_prefix": nik_service.TEMP_PREFIX,
    }


@router.get("/meta")
async def meta(user: dict = Depends(get_current_user)):
    return await build_meta()
