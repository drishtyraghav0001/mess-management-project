"""Create (or reset) a web login in the APP_USERS table.

Usage (from the backend folder, with the venv active):
    python create_user.py                       # asks every question
    python create_user.py --username admin --role admin
    python create_user.py --username aarav --role student --student-id 101
    python create_user.py --list                # show existing logins
    python create_user.py --username aarav --reset-password

The password is typed in hidden (getpass) and stored only as a bcrypt hash.
"""
import argparse
import getpass
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import oracledb  # noqa: E402

from app.config import settings  # noqa: E402
from app.security import ROLES, hash_password  # noqa: E402


def connect() -> oracledb.Connection:
    missing = settings.missing_db_settings()
    if missing:
        sys.exit(f"Missing in .env: {', '.join(missing)}")
    if settings.oracle_thick_mode:
        oracledb.init_oracle_client(lib_dir=settings.oracle_client_lib_dir)
    return oracledb.connect(user=settings.db_user, password=settings.db_password, dsn=settings.db_dsn)


def ask_password() -> str:
    pw = os.environ.get("MESS_NEW_PASSWORD")  # for automated tests only
    if pw:
        return pw
    while True:
        pw = getpass.getpass("Password (min 6 chars, hidden): ")
        if len(pw) < 6:
            print("  Too short.")
            continue
        if pw != getpass.getpass("Repeat password: "):
            print("  Passwords do not match, try again.")
            continue
        return pw


def main() -> None:
    ap = argparse.ArgumentParser(description="Create a login for the Mess Management System")
    ap.add_argument("--username")
    ap.add_argument("--role", choices=ROLES)
    ap.add_argument("--student-id", type=int)
    ap.add_argument("--reset-password", action="store_true", help="change the password of an existing user")
    ap.add_argument("--list", action="store_true", help="list existing users")
    args = ap.parse_args()

    try:
        conn = connect()
    except oracledb.Error as exc:
        sys.exit(f"Could not connect to Oracle: {exc}")
    cur = conn.cursor()
    try:
        cur.execute("SELECT COUNT(*) FROM user_tables WHERE table_name = 'APP_USERS'")
        if cur.fetchone()[0] == 0:
            sys.exit("APP_USERS table not found. Run database/01_app_users.sql in SQL*Plus first.")

        if args.list:
            cur.execute("SELECT user_id, username, role, student_id, is_active FROM app_users ORDER BY user_id")
            print(f"{'ID':<4}{'USERNAME':<20}{'ROLE':<10}{'STUDENT':<9}ACTIVE")
            for r in cur:
                print(f"{r[0]:<4}{r[1]:<20}{r[2]:<10}{str(r[3] or ''):<9}{r[4]}")
            return

        username = (args.username or input("Username: ")).strip()
        if not username:
            sys.exit("Username is required.")

        if args.reset_password:
            pw_hash = hash_password(ask_password())
            cur.execute("UPDATE app_users SET password_hash = :h WHERE LOWER(username) = LOWER(:u)",
                        {"h": pw_hash, "u": username})
            if cur.rowcount == 0:
                sys.exit(f"User '{username}' not found.")
            conn.commit()
            print(f"Password for '{username}' updated.")
            return

        role = args.role or input("Role (admin / staff / student): ").strip().lower()
        if role not in ROLES:
            sys.exit("Role must be admin, staff or student.")
        student_id = args.student_id
        if role == "student" and student_id is None:
            student_id = int(input("STUDENT_ID this login belongs to (e.g. 101): ").strip())
        if role != "student":
            student_id = None
        if student_id is not None:
            cur.execute("SELECT student_name FROM student WHERE student_id = :id", {"id": student_id})
            row = cur.fetchone()
            if not row:
                sys.exit(f"STUDENT_ID {student_id} does not exist in STUDENT.")
            print(f"Linking to student {student_id} - {row[0]}")

        pw_hash = hash_password(ask_password())
        cur.execute("SELECT NVL(MAX(user_id), 0) + 1 FROM app_users")
        new_id = cur.fetchone()[0]
        cur.execute("""INSERT INTO app_users (user_id, username, password_hash, role, student_id)
                       VALUES (:id, :u, :h, :r, :s)""",
                    {"id": new_id, "u": username, "h": pw_hash, "r": role, "s": student_id})
        conn.commit()
        print(f"User '{username}' created with role '{role}' (USER_ID {new_id}).")
    except oracledb.IntegrityError as exc:
        if "UQ_APP_USERS_USERNAME" in str(exc):
            sys.exit(f"Username '{username}' already exists. Use --reset-password to change its password.")
        sys.exit(f"Oracle rejected the user: {exc}")
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
