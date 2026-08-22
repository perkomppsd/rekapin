"""GET /api/meta — mengirim definisi skema ke frontend.

Berkat endpoint ini frontend tidak perlu menyalin daftar field/status/tab.
Ubah app/schema.py, dan form, tabel, filter, serta dropdown email di frontend
ikut berubah tanpa edit kode frontend.
"""

from fastapi import APIRouter, Depends

from .. import schema
from ..services import nik as nik_service
from ..emailing import templates
from ..security import get_current_user

router = APIRouter(tags=["meta"])


def _field_payload(f: schema.FieldSpec) -> dict:
    return {
        "key": f.key,
        "label": f.label,
        "type": f.type,
        "group": f.group,
        "default": f.default,
        "options": list(schema.STATUS_SETS.get(f.options, [])) if f.options else None,
        "required": f.required,
        "placeholder": f.placeholder,
        "hint": f.hint,
        "span": f.span,
        "searchable": f.searchable,
        "sensitive": f.sensitive,
    }


def build_meta() -> dict:
    return {
        "fields": [_field_payload(f) for f in schema.FIELDS],
        "groups": [{"key": k, "label": label} for k, label in schema.FIELD_GROUPS],
        "statuses": schema.STATUS_SETS,
        "tabs": [{"key": t.key, "label": t.label, "icon": t.icon, "tone": t.tone,
                   "stat": t.stat, "stat_label": t.stat_label or t.label}
                  for t in schema.TABS],
        "funnel": [{"key": k, "label": label} for k, label, _p, _q in schema.FUNNEL],
        "email_templates": templates.public_templates(),
        "import_columns": [
            {"key": key, "label": schema.FIELD_BY_KEY[key].label}
            for key in schema.IMPORT_POSITIONAL
        ],
        "system_fields": [{"key": k, "label": label} for k, label in schema.SYSTEM_FIELDS],
        "searchable_fields": schema.SEARCHABLE_FIELDS,
        "nik_temp_prefix": nik_service.TEMP_PREFIX,
    }


@router.get("/meta")
async def meta(user: dict = Depends(get_current_user)):
    return build_meta()
