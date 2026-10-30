import oracledb

from ..db import fetch_all, scalar
from ..schema_meta import meta
from .common import Where


def list_students(cur: oracledb.Cursor, search: str | None, hostel: str | None, status: str | None) -> list[dict]:
    w = Where()
    if search:
        searchable = [c for c in ("STUDENT_NAME", "EMAIL", "ROOM_NO", "PHONE", "HOSTEL_NAME")
                      if meta.has_column("STUDENT", c)]
        ors = [f"UPPER(s.{c}) LIKE :q" for c in searchable] + ["TO_CHAR(s.STUDENT_ID) LIKE :q"]
        w.add("(" + " OR ".join(ors) + ")", q=f"%{search.upper()}%")
    if hostel and meta.has_column("STUDENT", "HOSTEL_NAME"):
        w.add("s.HOSTEL_NAME = :hostel", hostel=hostel)
    if status and meta.has_column("STUDENT", "STATUS"):
        w.add("s.STATUS = :status", status=status)
    return fetch_all(cur, f"SELECT s.* FROM STUDENT s{w.sql()} ORDER BY s.STUDENT_ID", w.binds)


def total_paid(cur: oracledb.Cursor, student_id: int) -> float:
    """Calls your stored function TOTAL_PAID(P_STUDENT_ID)."""
    value = cur.callfunc("TOTAL_PAID", oracledb.DB_TYPE_NUMBER, [student_id])
    return float(value or 0)


def meals_attended(cur: oracledb.Cursor, student_id: int) -> int:
    """Calls your stored function MEALS_ATTENDED(P_STUDENT_ID)."""
    value = cur.callfunc("MEALS_ATTENDED", oracledb.DB_TYPE_NUMBER, [student_id])
    return int(value or 0)


def related_counts(cur: oracledb.Cursor, student_id: int) -> dict:
    counts = {}
    for table in ("PAYMENT", "ATTENDANCE", "COMPLAINT", "APP_USERS"):
        if meta.has_table(table):
            counts[table.lower()] = int(scalar(cur, f"SELECT COUNT(*) FROM {table} WHERE STUDENT_ID = :id",
                                               {"id": student_id}))
    return counts
