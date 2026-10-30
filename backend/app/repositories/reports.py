import oracledb

from ..db import fetch_all, scalar
from .common import student_col


def count(cur: oracledb.Cursor, table: str, where: str = "", binds: dict | None = None) -> int:
    # table/where are fixed strings written in this file, never user input
    return int(scalar(cur, f"SELECT COUNT(*) FROM {table} {where}", binds or {}) or 0)


def payment_by_student(cur: oracledb.Cursor) -> list[dict]:
    """Uses your TOTAL_PAID function inside SQL for every student."""
    return fetch_all(cur, f"""
        SELECT s.STUDENT_ID, s.STUDENT_NAME, {student_col('s', 'HOSTEL_NAME')} AS hostel_name,
               TOTAL_PAID(s.STUDENT_ID) AS total_paid,
               (SELECT COUNT(*) FROM PAYMENT p WHERE p.STUDENT_ID = s.STUDENT_ID) AS payments,
               (SELECT NVL(SUM(p.AMOUNT), 0) FROM PAYMENT p
                 WHERE p.STUDENT_ID = s.STUDENT_ID AND p.PAYMENT_STATUS = 'Pending') AS pending_amount
        FROM STUDENT s ORDER BY s.STUDENT_ID""")


def students_without_payment(cur: oracledb.Cursor, month: str) -> list[dict]:
    """NOT EXISTS subquery: students with no PAYMENT row at all for the month."""
    return fetch_all(cur, f"""
        SELECT s.STUDENT_ID, s.STUDENT_NAME, {student_col('s', 'HOSTEL_NAME')} AS hostel_name,
               {student_col('s', 'ROOM_NO')} AS room_no
        FROM STUDENT s
        WHERE NOT EXISTS (SELECT 1 FROM PAYMENT p
                          WHERE p.STUDENT_ID = s.STUDENT_ID AND p.PAYMENT_MONTH = :mon)
        ORDER BY s.STUDENT_ID""", {"mon": month})


def wastage_vs_planned(cur: oracledb.Cursor) -> list[dict]:
    return fetch_all(cur, """
        SELECT mi.MENU_ITEM_ID, mi.MENU_ID, mi.MEAL_TYPE, f.FOOD_NAME, mi.QUANTITY_PLANNED,
               NVL(SUM(w.QUANTITY_WASTED), 0) AS total_wasted,
               CASE WHEN mi.QUANTITY_PLANNED > 0
                    THEN ROUND(NVL(SUM(w.QUANTITY_WASTED), 0) * 100 / mi.QUANTITY_PLANNED, 1) END AS wasted_percent
        FROM MENU_ITEM mi
        JOIN FOOD_ITEM f ON f.FOOD_ID = mi.FOOD_ID
        LEFT JOIN WASTAGE w ON w.MENU_ITEM_ID = mi.MENU_ITEM_ID
        GROUP BY mi.MENU_ITEM_ID, mi.MENU_ID, mi.MEAL_TYPE, f.FOOD_NAME, mi.QUANTITY_PLANNED
        HAVING NVL(SUM(w.QUANTITY_WASTED), 0) > 0
        ORDER BY wasted_percent DESC NULLS LAST""")


def high_open_complaints(cur: oracledb.Cursor) -> list[dict]:
    return fetch_all(cur, """
        SELECT c.COMPLAINT_ID, s.STUDENT_NAME, c.COMPLAINT_TYPE, c.DESCRIPTION, c.SEVERITY, c.STATUS,
               c.COMPLAINT_DATE
        FROM COMPLAINT c JOIN STUDENT s ON s.STUDENT_ID = c.STUDENT_ID
        WHERE c.STATUS <> 'Resolved'
        ORDER BY DECODE(c.SEVERITY, 'High', 1, 'Medium', 2, 'Low', 3, 4), c.COMPLAINT_DATE""")
