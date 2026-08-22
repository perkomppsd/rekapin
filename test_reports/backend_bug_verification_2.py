import json
import os
import time
from pathlib import Path

import requests


def read_frontend_backend_url():
    env_path = Path('/app/frontend/.env')
    for line in env_path.read_text().splitlines():
        if line.startswith('REACT_APP_BACKEND_URL='):
            return line.split('=', 1)[1].strip().strip('"')
    raise RuntimeError('REACT_APP_BACKEND_URL not found')


BASE_URL = read_frontend_backend_url()
API = f"{BASE_URL}/api"
EMAIL = 'wardah.nabilah97@gmail.com'
PASSWORD = 'admin123'
RUN_ID = str(int(time.time()))

created_ids = []
evidence = {
    'api': API,
    'run_id': RUN_ID,
    'checks': [],
}


def check(condition, message, details=None):
    evidence['checks'].append({'message': message, 'passed': bool(condition), 'details': details or {}})
    if not condition:
        raise AssertionError(f"FAILED: {message} {details or ''}")
    print(f"PASS: {message}")


def main():
    session = requests.Session()
    r = session.post(f"{API}/auth/login", json={'email': EMAIL, 'password': PASSWORD}, timeout=20)
    check(r.status_code == 200, 'admin login returns 200', {'status': r.status_code, 'body': r.text[:300]})
    token = r.json()['access_token']
    session.headers.update({'Authorization': f'Bearer {token}'})

    candidate_payload = {
        'nama': f'API Date Email Blacklist {RUN_ID}',
        'email': f'api.date.{RUN_ID}@example.com',
        'no_hp': f'08{RUN_ID[-8:]}',
        'usia': 29,
        'apply': 'Kasir API',
        'rencana_penempatan': 'Jakarta API',
        'alamat': 'Jl API',
        'pic': 'QA-API',
        'status_interview': 'Terjadwal',
        'tanggal_interview': '2026-03-15',
        'jam_interview': '09:30',
        'metode_interview': 'Online',
        'status_blacklist': 'Ya - Tidak Hadir',
        'alasan_blacklist': 'API reason: tidak hadir interview',
        'keterangan': 'backend verification candidate',
    }
    r = session.post(f"{API}/candidates", json=candidate_payload, timeout=20)
    check(r.status_code == 200, 'POST /candidates accepts email/date/blacklist reason', {'status': r.status_code, 'body': r.text[:500]})
    created = r.json()
    created_ids.append(created['id'])
    check(created.get('email') == candidate_payload['email'], 'created candidate response includes saved email')
    check(created.get('tanggal_interview') == '2026-03-15', 'created candidate response includes saved tanggal_interview')
    check(created.get('alasan_blacklist') == candidate_payload['alasan_blacklist'], 'created candidate response includes saved alasan_blacklist')

    r = session.get(f"{API}/candidates", timeout=20)
    check(r.status_code == 200, 'GET /candidates returns 200 after create')
    rows = r.json()
    found = next((x for x in rows if x.get('id') == created['id']), None)
    check(found is not None, 'created candidate persists in list')
    check(found.get('email') == candidate_payload['email'] and found.get('tanggal_interview') == '2026-03-15' and found.get('alasan_blacklist') == candidate_payload['alasan_blacklist'], 'persisted list has email/date/blacklist reason', found)

    bulk_items = [
        {
            'nama': f'API Bulk Andi {RUN_ID}',
            'email': f'api.bulk.andi.{RUN_ID}@x.com',
            'no_hp': '0811',
            'usia': 23,
            'apply': 'Kasir',
            'rencana_penempatan': 'Jakarta',
            'alamat': 'Jl A',
            'pic': 'HR-1',
            'keterangan': '-',
        },
        {
            'nama': f'API Bulk Budi {RUN_ID}',
            'email': f'api.bulk.budi.{RUN_ID}@x.com',
            'no_hp': '0812',
            'usia': 25,
            'apply': 'Sales',
            'rencana_penempatan': 'Surabaya',
            'alamat': 'Jl B',
            'pic': 'HR-2',
            'keterangan': '-',
        },
    ]
    r = session.post(f"{API}/candidates/bulk", json={'items': bulk_items}, timeout=20)
    check(r.status_code == 200, 'POST /candidates/bulk returns 200 for two candidates', {'status': r.status_code, 'body': r.text[:500]})
    check(r.json().get('inserted') == 2, 'bulk endpoint reports inserted=2', r.json())

    r = session.get(f"{API}/candidates", timeout=20)
    rows = r.json()
    for item in bulk_items:
        found = next((x for x in rows if x.get('nama') == item['nama']), None)
        check(found is not None, f"bulk-created candidate appears in list: {item['nama']}")
        if found:
            created_ids.append(found['id'])
            check(found.get('email') == item['email'], f"bulk-created candidate email saved: {item['nama']}")

    evidence['created_ids'] = created_ids


if __name__ == '__main__':
    try:
        main()
        evidence['status'] = 'passed'
    except Exception as exc:
        evidence['status'] = 'failed'
        evidence['error'] = repr(exc)
        raise
    finally:
        Path('/app/test_reports/backend_bug_verification_2_result.json').write_text(json.dumps(evidence, indent=2))