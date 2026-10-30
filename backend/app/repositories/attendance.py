from datetime import date

import oracledb

from ..db import fetch_all
from .common import Where, date_bind, menu_date_sql


def _filters(student_id, menu_id, date_from, date_to, meal_type, status) -> tuple[Where, str]:
    d = menu_date_sql("m")
    w = Where()
    if student_id:
        w.add("a.STUDENT_ID = :sid", sid=student_id)
    if menu_id:
        w.add("a.MENU_ID = :mid", mid=menu_id)
    if date_from:
        w.add(f"{d} >= :dfrom", dfrom=date_bind(date_from))
    if date_to:
        w.add(f"{d} <= :dto", dto=date_bind(date_to))
    if meal_type:
        w.add("a.MEAL_TYPE = :mt", mt=meal_type)
    if status:
        w.add("a.STATUS = :st", st=status)
    return w, d


def list_attendance(cur: oracledb.Cursor, student_id: int | None = None, menu_id: int | None = None,
                    date_from: date | None = None, date_to: date | None = None,
                    meal_type: str | None = None, status: str | None = None) -> list[dict]:
    w, d = _filters(student_id, menu_id, date_from, date_to, meal_type, status)
    return fetch_all(cur, f"""
        SELECT a.ATTENDANCE_ID, a.STUDENT_ID, s.STUDENT_NAME, a.MENU_ID, {d} AS menu_date,
               a.MEAL_TYPE, a.ATTENDANCE_TIME, a.STATUS
        FROM ATTENDANCE a
        JOIN STUDENT s ON s.STUDENT_ID = a.STUDENT_ID
        JOIN MENU m ON m.MENU_ID = a.MENU_ID{w.sql()}
        ORDER BY {d} DESC NULLS LAST, a.ATTENDANCE_TIME DESC NULLS LAST, a.ATTENDANCE_ID DESC""", w.binds)


def summary_by_student(cur: oracledb.Cursor, student_id: int | None = None) -> list[dict]:
    """Uses your MEALS_ATTENDED function inside SQL for every student."""
    w = Where()
    if student_id:
        w.add("s.STUDENT_ID = :sid", sid=student_id)
    return fetch_all(cur, f"""
        SELECT s.STUDENT_ID, s.STUDENT_NAME,
               COUNT(a.ATTENDANCE_ID) AS total_records,
               SUM(CASE WHEN a.STATUS = 'Present' THEN 1 ELSE 0 END) AS present,
               SUM(CASE WHEN a.STATUS = 'Absent' THEN 1 ELSE 0 END) AS absent,
               MEALS_ATTENDED(s.STUDENT_ID) AS meals_attended
        FROM STUDENT s LEFT JOIN ATTENDANCE a ON a.STUDENT_ID = s.STUDENT_ID{w.sql()}
        GROUP BY s.STUDENT_ID, s.STUDENT_NAME
        ORDER BY s.STUDENT_ID""", w.binds)


def summary_by_meal(cur: oracledb.Cursor, student_id: int | None = None) -> list[dict]:
    w = Where()
    if student_id:
        w.add("a.STUDENT_ID = :sid", sid=student_id)
    return fetch_all(cur, f"""
        SELECT a.MEAL_TYPE,
               SUM(CASE WHEN a.STATUS = 'Present' THEN 1 ELSE 0 END) AS present,
               SUM(CASE WHEN a.STATUS = 'Absent' THEN 1 ELSE 0 END) AS absent,
               COUNT(*) AS total
        FROM ATTENDANCE a{w.sql()}
        GROUP BY a.MEAL_TYPE
        ORDER BY DECODE(a.MEAL_TYPE, 'Breakfast', 1, 'Lunch', 2, 'Snack', 3, 'Dinner', 4, 5)""", w.binds)


def summary_by_date(cur: oracledb.Cursor, student_id: int | None = None) -> list[dict]:
    d = menu_date_sql("m")
    w = Where()
    if student_id:
        w.add("a.STUDENT_ID = :sid", sid=student_id)
    return fetch_all(cur, f"""
        SELECT {d} AS menu_date,
               SUM(CASE WHEN a.STATUS = 'Present' THEN 1 ELSE 0 END) AS present,
               SUM(CASE WHEN a.STATUS = 'Absent' THEN 1 ELSE 0 END) AS absent
        FROM ATTENDANCE a JOIN MENU m ON m.MENU_ID = a.MENU_ID{w.sql()}
        GROUP BY {d} ORDER BY {d}""", w.binds)
