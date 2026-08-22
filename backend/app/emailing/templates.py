"""Katalog template email — TEMPAT MENGUBAH ISI/TEKS EMAIL.

Cara menambah template baru:
  1. Tambah satu entri `TemplateSpec` di `TEMPLATES`.
  2. Selesai. Template langsung muncul di dropdown "Kirim Email" di frontend
     (frontend mengambil daftarnya dari GET /api/meta).

Placeholder yang tersedia di `subject` dan `body` (pakai gaya $nama):
  $nama              nama kandidat
  $posisi            posisi yang dilamar (apply / posisi penempatan)
  $posisi_final      posisi final kalau sudah fix (posisi fix / apply)
  $tanggal           tanggal interview
  $jam               jam interview
  $metode            metode interview (Online/Offline/Telepon)
  $penempatan        penempatan fix / rencana penempatan
  $penempatan_klausa " dengan penempatan di <b>X</b>" (kosong kalau belum ada)
  $email_kandidat    email kandidat
  $no_hp             no HP kandidat
  $app_url           URL aplikasi
Semua nilai sudah di-escape HTML, jadi aman dipakai langsung.

`fallbacks` = teks pengganti kalau data kandidat masih kosong.
"""

from dataclasses import dataclass, field as dc_field
from html import escape
from string import Template
from typing import Dict, List, Optional, Tuple

from .. import config
from .sender import wrap


@dataclass(frozen=True)
class TemplateSpec:
    id: str
    label: str                                  # judul di dropdown frontend
    subject: str
    body: str
    fallbacks: Dict[str, str] = dc_field(default_factory=dict)
    internal: bool = False                      # True = tidak muncul di dropdown kandidat


TEMPLATES: Tuple[TemplateSpec, ...] = (
    TemplateSpec(
        id="panggilan_tes",
        label="Panggilan Tes Seleksi",
        subject="[Undangan Tes] $posisi — $nama",
        fallbacks={"tanggal": "menunggu jadwal", "jam": "menunggu jadwal",
                   "metode": "akan diinformasikan"},
        body=(
            '<h2 style="margin:0 0 4px">Panggilan Tes Seleksi</h2>'
            '<p>Halo $nama,</p>'
            '<p>Terima kasih telah melamar untuk posisi <strong>$posisi</strong> di perusahaan kami. '
            'Kami mengundang Anda untuk mengikuti <strong>tes seleksi</strong> dengan detail berikut:</p>'
            '<ul>'
            '<li>Tanggal: <strong>$tanggal</strong></li>'
            '<li>Jam: <strong>$jam</strong></li>'
            '<li>Metode: <strong>$metode</strong></li>'
            '</ul>'
            '<p>Mohon konfirmasi kehadiran Anda dengan membalas email ini.</p>'
            '<p>Salam,<br/>Tim Rekrutmen</p>'
        ),
    ),
    TemplateSpec(
        id="panggilan_interview",
        label="Undangan Interview",
        subject="[Undangan Interview] $posisi — $nama",
        fallbacks={"tanggal": "TBD", "jam": "TBD", "metode": "TBD"},
        body=(
            '<h2 style="margin:0 0 4px">Undangan Interview</h2>'
            '<p>Halo $nama,</p>'
            '<p>Selamat! Anda kami undang untuk mengikuti <strong>interview</strong> untuk posisi '
            '<strong>$posisi</strong> pada:</p>'
            '<ul>'
            '<li>Tanggal: <strong>$tanggal</strong></li>'
            '<li>Jam: <strong>$jam</strong></li>'
            '<li>Metode: <strong>$metode</strong></li>'
            '</ul>'
            '<p>Mohon konfirmasi kehadiran dan siapkan CV serta dokumen pendukung.</p>'
            '<p>Salam,<br/>Tim Rekrutmen</p>'
        ),
    ),
    TemplateSpec(
        id="lolos_ttd",
        label="Lolos & Undangan TTD Kesepakatan",
        subject="[LOLOS] Undangan Tanda Tangan Kesepakatan — $nama",
        body=(
            '<h2 style="margin:0 0 4px">Selamat! Anda Lolos Interview</h2>'
            '<p>Halo $nama,</p>'
            '<p>Selamat, Anda dinyatakan <strong>LOLOS</strong> tahap seleksi untuk posisi '
            '<strong>$posisi</strong>$penempatan_klausa.</p>'
            '<p>Sebagai tahap selanjutnya, kami mengundang Anda untuk melakukan '
            '<strong>tanda tangan kesepakatan kerja</strong>. '
            'Mohon konfirmasi kehadiran Anda dengan membalas email ini agar kami dapat mengatur jadwal.</p>'
            '<p>Salam hangat,<br/>Tim Rekrutmen</p>'
        ),
    ),
    TemplateSpec(
        id="reminder",
        label="Reminder Jadwal",
        subject="[Reminder] Jadwal Anda — $nama",
        fallbacks={"tanggal": "-", "jam": "-", "metode": "-"},
        body=(
            '<h2 style="margin:0 0 4px">Reminder Jadwal</h2>'
            '<p>Halo $nama,</p>'
            '<p>Ini adalah pengingat untuk jadwal Anda pada <strong>$tanggal</strong> pukul '
            '<strong>$jam</strong> ($metode) untuk posisi <strong>$posisi</strong>.</p>'
            '<p>Sampai jumpa!</p>'
            '<p>Salam,<br/>Tim Rekrutmen</p>'
        ),
    ),
    TemplateSpec(
        id="kandidat_baru_internal",
        label="Notifikasi Internal: Kandidat Diterima",
        internal=True,
        subject="[Kandidat Baru] $nama siap dibuatkan akun",
        body=(
            '<h2 style="margin:0 0 4px">Kandidat Baru Diterima — Butuh Akun</h2>'
            '<p>Halo $penerima,</p>'
            '<p>Ada kandidat baru yang telah lolos dan siap dibuatkan akun sistem:</p>'
            '<table role="presentation" style="width:100%;border-collapse:collapse;'
            'font-family:Arial,sans-serif;font-size:14px">'
            '<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb"><strong>Nama</strong></td>'
            '<td style="padding:8px;border-bottom:1px solid #e5e7eb">$nama</td></tr>'
            '<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb"><strong>Posisi</strong></td>'
            '<td style="padding:8px;border-bottom:1px solid #e5e7eb">$posisi_final</td></tr>'
            '<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb"><strong>Penempatan</strong></td>'
            '<td style="padding:8px;border-bottom:1px solid #e5e7eb">$penempatan</td></tr>'
            '<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb"><strong>Email</strong></td>'
            '<td style="padding:8px;border-bottom:1px solid #e5e7eb">$email_kandidat</td></tr>'
            '<tr><td style="padding:8px"><strong>No HP</strong></td>'
            '<td style="padding:8px">$no_hp</td></tr>'
            '</table>'
            '<p style="margin-top:16px">Mohon buatkan akun / atur absensi untuk kandidat ini. '
            'Terima kasih!</p>'
        ),
    ),
)

TEMPLATE_BY_ID: Dict[str, TemplateSpec] = {t.id: t for t in TEMPLATES}


def _context(candidate: dict, extra: Optional[dict] = None) -> Dict[str, str]:
    """Bangun placeholder dari data kandidat (semua nilai sudah di-escape)."""
    c = candidate or {}
    penempatan = escape(c.get("penempatan_fix") or c.get("rencana_penempatan") or "")
    ctx = {
        "nama": escape(c.get("nama", "")),
        "posisi": escape(c.get("apply") or c.get("posisi_penempatan") or ""),
        "posisi_final": escape(c.get("posisi_fix") or c.get("apply") or ""),
        "tanggal": escape(c.get("tanggal_interview", "")),
        "jam": escape(c.get("jam_interview", "")),
        "metode": escape(c.get("metode_interview", "")),
        "penempatan": penempatan,
        "email_kandidat": escape(c.get("email", "")),
        "no_hp": escape(c.get("no_hp", "")),
        "app_url": escape(config.PUBLIC_APP_URL.rstrip("/")),
    }
    ctx["penempatan_klausa"] = (
        f' dengan penempatan di <strong>{penempatan}</strong>' if penempatan else ""
    )
    ctx.update(extra or {})
    return ctx


def render(template_id: str, candidate: dict, extra: Optional[dict] = None) -> Optional[dict]:
    """Return {"subject", "html"} atau None kalau template tidak dikenal."""
    spec = TEMPLATE_BY_ID.get(template_id)
    if spec is None:
        return None
    ctx = _context(candidate, extra)
    for key, fallback in spec.fallbacks.items():
        if not ctx.get(key):
            ctx[key] = escape(fallback)
    return {
        "subject": Template(spec.subject).safe_substitute(ctx),
        "html": wrap(Template(spec.body).safe_substitute(ctx)),
    }


def public_templates() -> List[dict]:
    """Daftar template yang boleh dipilih user untuk dikirim ke kandidat."""
    return [{"id": t.id, "label": t.label} for t in TEMPLATES if not t.internal]
