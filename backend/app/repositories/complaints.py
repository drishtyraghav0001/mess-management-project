import oracledb

from ..db import fetch_all, fetch_one
from .common import Where, menu_date_sql

_SELECT = """
    SELECT c.COMPLAINT_ID, c.STUDENT_ID, s.STUDENT_NAME, c.MENU_ID, {d} AS menu_date,
           c.COMPLAINT_DATE, c.COMPLAINT_TYPE, c.DESCRIPTION, c.SEVERITY, c.STATUS
    FROM COMPLAINT c
    JOIN STUDENT s ON s.STUDENT_ID = c.STUDENT_ID
    LEFT JOIN MENU m ON m.MENU_ID = c.MENU_ID"""


def list_complaints(cur: oracledb.Cursor, severity: str | None = None, status: str | None = None,
                    student_id: int | None = None, complaint_type: str | None = None,
                    search: str | None = None) -> list[dict]:
    w = Where()
    if severity:
        w.add("c.SEVERITY = :sev", sev=severity)
    if status:
        w.add("c.STATUS = :st", st=status)
    if student_id:
        w.add("c.STUDENT_ID = :sid", sid=student_id)
    if complaint_type:
        w.add("c.COMPLAINT_TYPE = :ct", ct=complaint_type)
    if search:
        w.add("(UPPER(c.DESCRIPTION) LIKE :q OR UPPER(s.STUDENT_NAME) LIKE :q OR UPPER(c.COMPLAINT_TYPE) LIKE :q)",
              q=f"%{search.upper()}%")
    sql = _SELECT.format(d=menu_date_sql("m")) + w.sql()
    return fetch_all(cur, sql + " ORDER BY c.COMPLAINT_DATE DESC NULLS LAST, c.COMPLAINT_ID DESC", w.binds)


def get_complaint(cur: oracledb.Cursor, complaint_id: int) -> dict | None:
    return fetch_one(cur, _SELECT.format(d=menu_date_sql("m")) + " WHERE c.COMPLAINT_ID = :id", {"id": complaint_id})


def resolve_via_procedure(cur: oracledb.Cursor, complaint_id: int) -> None:
    """Calls your stored procedure RESOLVE_COMPLAINT(P_COMPLAINT_ID)."""
    cur.callproc("RESOLVE_COMPLAINT", [complaint_id])


def set_status(cur: oracledb.Cursor, complaint_id: int, status: str) -> int:
    cur.execute("UPDATE COMPLAINT SET STATUS = :st WHERE COMPLAINT_ID = :id", {"st": status, "id": complaint_id})
    return cur.rowcount


def summary(cur: oracledb.Cursor, student_id: int | None = None) -> dict:
    w = Where()
    if student_id:
        w.add("STUDENT_ID = :sid", sid=student_id)
    by_status = fetch_all(cur, f"SELECT STATUS AS status, COUNT(*) AS count FROM COMPLAINT{w.sql()} "
                               "GROUP BY STATUS ORDER BY DECODE(STATUS,'Open',1,'In Progress',2,'Resolved',3,4)", w.binds)
    by_severity = fetch_all(cur, f"SELECT SEVERITY AS severity, COUNT(*) AS count FROM COMPLAINT{w.sql()} "
                                 "GROUP BY SEVERITY ORDER BY DECODE(SEVERITY,'High',1,'Medium',2,'Low',3,4)", w.binds)
    by_type = fetch_all(cur, f"SELECT COMPLAINT_TYPE AS complaint_type, COUNT(*) AS count FROM COMPLAINT{w.sql()} "
                             "GROUP BY COMPLAINT_TYPE ORDER BY COUNT(*) DESC", w.binds)
    return {"by_status": by_status, "by_severity": by_severity, "by_type": by_type}
