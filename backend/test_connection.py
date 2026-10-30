"""Step 1 check: can Python reach your Oracle database?

Run from the backend folder (venv active):
    python test_connection.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import oracledb  # noqa: E402

from app.config import settings  # noqa: E402

TABLES = ["STUDENT", "MENU", "FOOD_ITEM", "MENU_ITEM", "ATTENDANCE", "PAYMENT", "COMPLAINT", "WASTAGE",
          "PAYMENT_AUDIT", "APP_USERS"]
PROGRAMS = ["ADD_MESS_PAYMENT", "RESOLVE_COMPLAINT", "TOTAL_PAID", "MEALS_ATTENDED",
            "PAYMENT_STATUS_AUDIT_TRG", "CHECK_FOOD_WASTAGE", "PAYMENT_AUDIT_SEQ"]

missing = settings.missing_db_settings()
if missing:
    sys.exit(f"Missing in .env: {', '.join(missing)}  (copy .env.example to .env and fill it in)")

try:
    if settings.oracle_thick_mode:
        oracledb.init_oracle_client(lib_dir=settings.oracle_client_lib_dir)
    with oracledb.connect(user=settings.db_user, password=settings.db_password, dsn=settings.db_dsn) as conn:
        print(f"Connected to Oracle {conn.version} as {settings.db_user} ({settings.db_dsn})")
        print(f"python-oracledb {oracledb.__version__} in {'thick' if settings.oracle_thick_mode else 'thin'} mode\n")
        cur = conn.cursor()
        cur.execute("SELECT table_name FROM user_tables")
        existing = {r[0] for r in cur}
        print("Tables:")
        for t in TABLES:
            if t in existing:
                cur.execute(f"SELECT COUNT(*) FROM {t}")  # fixed list, not user input
                print(f"  {t:<14} {cur.fetchone()[0]:>5} rows")
            else:
                note = "  <- run database/01_app_users.sql" if t == "APP_USERS" else "  <- MISSING"
                print(f"  {t:<14} not found{note}")
        cur.execute("""SELECT object_name, object_type, status FROM user_objects
                       WHERE object_type IN ('PROCEDURE','FUNCTION','TRIGGER','SEQUENCE')""")
        objs = {r[0]: (r[1], r[2]) for r in cur}
        print("\nPL/SQL objects:")
        for p in PROGRAMS:
            t, s = objs.get(p, ("?", "NOT FOUND"))
            print(f"  {p:<26} {t:<10} {s}")
        cur.execute("SELECT MIN(student_id) FROM student")
        sid = cur.fetchone()[0]
        if sid is not None and "TOTAL_PAID" in objs:
            print(f"\nTOTAL_PAID({sid})     = {cur.callfunc('TOTAL_PAID', oracledb.DB_TYPE_NUMBER, [sid])}")
            print(f"MEALS_ATTENDED({sid}) = {cur.callfunc('MEALS_ATTENDED', oracledb.DB_TYPE_NUMBER, [sid])}")
    print("\nConnection test passed.")
except oracledb.Error as e:
    msg = str(e)
    print("Oracle error:", msg)
    if "DPY-3010" in msg or "DPY-3015" in msg:
        print("Hint: your Oracle version is older than 12.1 - set ORACLE_THICK_MODE=true (see README).")
    elif "ORA-01017" in msg:
        print("Hint: wrong DB_USER or DB_PASSWORD in .env.")
    elif any(c in msg for c in ("DPY-6005", "DPY-6001", "ORA-12514", "ORA-12541", "DPY-4011")):
        print("Hint: check DB_DSN (host:port/service) and that the Oracle service is running (services.msc).")
    sys.exit(1)
