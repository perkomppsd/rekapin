"""JALUR DARURAT kalau tidak ada yang bisa masuk aplikasi.

Login aplikasi ini memakai akun Google. Kalau login Google bermasalah —
GOOGLE_CLIENT_ID salah, project Google terhapus, domain berubah, atau internet
kantor mati — TIDAK ADA yang bisa masuk. Script ini jalan keluarnya, dan bisa
dijalankan siapa pun yang punya akses ke server + database.

    cd backend
    .venv/bin/python scripts/akses_darurat.py                    # lihat kondisi
    .venv/bin/python scripts/akses_darurat.py --daftar-user
    .venv/bin/python scripts/akses_darurat.py --jadikan-admin email@gmail.com
    .venv/bin/python scripts/akses_darurat.py --set-password email@gmail.com

Untuk menghidupkan kembali login password sementara:
    1. Buka backend/.env, tambahkan/ubah:  PASSWORD_LOGIN=true
    2. Restart backend
    3. Masuk pakai email + password (set dulu dengan --set-password)
    4. Setelah Google beres, kembalikan PASSWORD_LOGIN=false
"""

import asyncio
import getpass
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import config                                  # noqa: E402
from app.db import client, db                           # noqa: E402
from app.security import hash_password                  # noqa: E402
from app.services.common import now_iso                 # noqa: E402


async def kondisi() -> None:
    jumlah = await db.users.count_documents({})
    admin = await db.users.count_documents({"role": "admin"})
    print("Kondisi login saat ini")
    print(f"  GOOGLE_CLIENT_ID : {'terisi' if config.GOOGLE_CLIENT_ID else 'KOSONG (login Google mati)'}")
    print(f"  Login password   : {'AKTIF' if config.password_login_enabled() else 'mati'}")
    print(f"  Jumlah user      : {jumlah} ({admin} admin)")
    if not config.GOOGLE_CLIENT_ID and not config.password_login_enabled():
        print("\n  PERINGATAN: dua-duanya mati — tidak ada yang bisa masuk.")
        print("  Set PASSWORD_LOGIN=true di backend/.env, restart, lalu --set-password.")
    print("\nPerintah lain: --daftar-user, --jadikan-admin EMAIL, --set-password EMAIL")


async def daftar_user() -> None:
    docs = await db.users.find({}, {"_id": 0, "name": 1, "email": 1, "role": 1}).to_list(500)
    if not docs:
        print("Belum ada user sama sekali.")
        return
    print(f"{len(docs)} user terdaftar:")
    for u in sorted(docs, key=lambda d: d.get("role", "")):
        print(f"  {u.get('role',''):<10} {u.get('name',''):<20} {u.get('email','')}")


async def jadikan_admin(email: str) -> None:
    email = email.strip().lower()
    user = await db.users.find_one({"email": email})
    if user:
        await db.users.update_one({"email": email}, {"$set": {"role": "admin"}})
        print(f"{email} sekarang admin.")
        return
    await db.users.insert_one({
        "id": str(uuid.uuid4()), "email": email, "name": email.split("@")[0],
        "role": "admin", "password_hash": "", "created_at": now_iso(),
    })
    print(f"User admin baru dibuat: {email}")
    print("Belum punya password — pakai --set-password kalau perlu login password.")


async def set_password(email: str) -> None:
    email = email.strip().lower()
    if not await db.users.find_one({"email": email}):
        print(f"User {email} tidak ada. Buat dulu dengan --jadikan-admin {email}")
        return
    pw = getpass.getpass("Password baru (tidak ditampilkan): ")
    if len(pw) < config.MIN_PASSWORD_LENGTH:
        print(f"Password minimal {config.MIN_PASSWORD_LENGTH} karakter.")
        return
    if pw != getpass.getpass("Ulangi password: "):
        print("Password tidak sama.")
        return
    await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(pw)}})
    print(f"Password {email} diperbarui.")
    if not config.password_login_enabled():
        print("\nCATATAN: login password masih MATI. Untuk memakainya:")
        print("  1. Tambahkan PASSWORD_LOGIN=true di backend/.env")
        print("  2. Restart backend")


async def main(argv) -> None:
    if "--daftar-user" in argv:
        await daftar_user()
    elif "--jadikan-admin" in argv:
        await jadikan_admin(argv[argv.index("--jadikan-admin") + 1])
    elif "--set-password" in argv:
        await set_password(argv[argv.index("--set-password") + 1])
    else:
        await kondisi()


if __name__ == "__main__":
    try:
        asyncio.run(main(sys.argv[1:]))
    finally:
        client.close()
