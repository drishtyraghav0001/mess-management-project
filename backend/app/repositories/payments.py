import oracledb

from ..db import fetch_all, fetch_one
from .common import Where


def list_payments(cur: oracledb.Cursor, status: str | None = None, student_id: int | None = None,
                  month: str | None = None, search: str | None = None) -> list[dict]:
    w = Where()
    if status:
        w.add("p.PAYMENT_STATUS = :st", st=status)
    if student_id:
        w.add("p.STUDENT_ID = :sid", sid=student_id)
    if month:
        w.add("p.PAYMENT_MONTH = :mon", mon=month)
    if search:
        w.add("(UPPER(s.STUDENT_NAME) LIKE :q OR TO_CHAR(p.STUDENT_ID) LIKE :q OR TO_CHAR(p.PAYMENT_ID) = :raw)",
              q=f"%{search.upper()}%", raw=search)
    return fetch_all(cur, f"""
        SELECT p.PAYMENT_ID, p.STUDENT_ID, s.STUDENT_NAME, p.PAYMENT_MONTH, p.PAYMENT_DATE,
               p.AMOUNT, p.PAYMENT_STATUS
        FROM PAYMENT p JOIN STUDENT s ON s.STUDENT_ID = p.STUDENT_ID{w.sql()}
        ORDER BY p.PAYMENT_DATE DESC NULLS LAST, p.PAYMENT_ID DESC""", w.binds)


def get_payment(cur: oracledb.Cursor, payment_id: int) -> dict | None:
    return fetch_one(cur, """
        SELECT p.PAYMENT_ID, p.STUDENT_ID, s.STUDENT_NAME, p.PAYMENT_MONTH, p.PAYMENT_DATE,
               p.AMOUNT, p.PAYMENT_STATUS
        FROM PAYMENT p JOIN STUDENT s ON s.STUDENT_ID = p.STUDENT_ID
        WHERE p.PAYMENT_ID = :id""", {"id": payment_id})


def add_payment_via_procedure(cur: oracledb.Cursor, payment_id: int, student_id: int,
                              month: str, amount: float) -> None:
    """Calls your stored procedure ADD_MESS_PAYMENT(P_PAYMENT_ID, P_STUDENT_ID, P_PAYMENT_MONTH, P_AMOUNT)."""
    cur.callproc("ADD_MESS_PAYMENT", [payment_id, student_id, month, amount])


def set_status(cur: oracledb.Cursor, payment_id: int, status: str) -> int:
    """A plain UPDATE of PAYMENT_STATUS, so PAYMENT_STATUS_AUDIT_TRG fires and writes PAYMENT_AUDIT."""
    cur.execute("UPDATE PAYMENT SET PAYMENT_STATUS = :st WHERE PAYMENT_ID = :id", {"st": status, "id": payment_id})
    return cur.rowcount


def list_audit(cur: oracledb.Cursor, payment_id: int | None = None) -> list[dict]:
    w = Where()
    if payment_id:
        w.add("pa.PAYMENT_ID = :pid", pid=payment_id)
    return fetch_all(cur, f"""
        SELECT pa.AUDIT_ID, pa.PAYMENT_ID, p.STUDENT_ID, s.STUDENT_NAME, p.PAYMENT_MONTH,
               pa.OLD_STATUS, pa.NEW_STATUS, pa.CHANGE_DATE
        FROM PAYMENT_AUDIT pa
        LEFT JOIN PAYMENT p ON p.PAYMENT_ID = pa.PAYMENT_ID
        LEFT JOIN STUDENT s ON s.STUDENT_ID = p.STUDENT_ID{w.sql()}
        ORDER BY pa.CHANGE_DATE DESC NULLS LAST, pa.AUDIT_ID DESC""", w.binds)


def summary_by_status(cur: oracledb.Cursor, student_id: int | None = None) -> list[dict]:
    w = Where()
    if student_id:
        w.add("STUDENT_ID = :sid", sid=student_id)
    return fetch_all(cur, f"""
        SELECT PAYMENT_STATUS AS status, COUNT(*) AS count, NVL(SUM(AMOUNT), 0) AS amount
        FROM PAYMENT{w.sql()} GROUP BY PAYMENT_STATUS ORDER BY PAYMENT_STATUS""", w.binds)


def summary_by_month(cur: oracledb.Cursor) -> list[dict]:
    return fetch_all(cur, """
        SELECT PAYMENT_MONTH,
               COUNT(*) AS payments,
               SUM(CASE WHEN PAYMENT_STATUS = 'Paid' THEN AMOUNT ELSE 0 END) AS paid_amount,
               SUM(CASE WHEN PAYMENT_STATUS = 'Pending' THEN AMOUNT ELSE 0 END) AS pending_amount,
               SUM(CASE WHEN PAYMENT_STATUS = 'Failed' THEN AMOUNT ELSE 0 END) AS failed_amount,
               SUM(CASE WHEN PAYMENT_STATUS = 'Paid' THEN 1 ELSE 0 END) AS paid_count,
               SUM(CASE WHEN PAYMENT_STATUS = 'Pending' THEN 1 ELSE 0 END) AS pending_count,
               MIN(PAYMENT_DATE) AS first_date
        FROM PAYMENT GROUP BY PAYMENT_MONTH ORDER BY MIN(PAYMENT_DATE) DESC NULLS LAST""")


def months(cur: oracledb.Cursor) -> list[str]:
    return [r["payment_month"] for r in fetch_all(cur, """
        SELECT PAYMENT_MONTH FROM PAYMENT GROUP BY PAYMENT_MONTH
        ORDER BY MIN(PAYMENT_DATE) DESC NULLS LAST""")]
