from datetime import datetime

import oracledb

from ..db import scalar
from ..errors import ApiError
from ..repositories import attendance as repo
from . import crud


def _duplicate(cur, student_id, menu_id, meal_type, exclude_id=None) -> bool:
    return bool(scalar(cur, """
        SELECT COUNT(*) FROM ATTENDANCE
        WHERE STUDENT_ID = :sid AND MENU_ID = :mid AND MEAL_TYPE = :mt
          AND (:ex IS NULL OR ATTENDANCE_ID <> :ex)""",
        {"sid": student_id, "mid": menu_id, "mt": meal_type, "ex": exclude_id}))


def _one(cur, attendance_id: int) -> dict:
    rows = [r for r in repo.list_attendance(cur) if r["attendance_id"] == attendance_id]
    return rows[0] if rows else {"attendance_id": attendance_id}


def create(conn: oracledb.Connection, payload: dict) -> dict:
    cur = conn.cursor()
    crud.ensure_exists(cur, "STUDENT", payload["student_id"], "student_id")
    crud.ensure_exists(cur, "MENU", payload["menu_id"], "menu_id")
    if _duplicate(cur, payload["student_id"], payload["menu_id"], payload["meal_type"]):
        raise ApiError(409, "Attendance is already recorded for this student, menu and meal type.")
    if not payload.get("attendance_time"):
        payload["attendance_time"] = datetime.now().replace(microsecond=0)
    row = crud.create(conn, "ATTENDANCE", payload)
    return _one(cur, row["attendance_id"])


def update(conn: oracledb.Connection, attendance_id: int, payload: dict) -> dict:
    cur = conn.cursor()
    crud.ensure_exists(cur, "ATTENDANCE", attendance_id)
    crud.ensure_exists(cur, "STUDENT", payload.get("student_id"), "student_id")
    crud.ensure_exists(cur, "MENU", payload.get("menu_id"), "menu_id")
    current = _one(cur, attendance_id)
    merged = {**current, **{k: v for k, v in payload.items() if v is not None}}
    if _duplicate(cur, merged["student_id"], merged["menu_id"], merged["meal_type"], attendance_id):
        raise ApiError(409, "Another attendance record already exists for this student, menu and meal type.")
    crud.update(conn, "ATTENDANCE", attendance_id, payload)
    return _one(cur, attendance_id)


def summary(conn: oracledb.Connection, student_id: int | None) -> dict:
    cur = conn.cursor()
    students = repo.summary_by_student(cur, student_id)
    for s in students:
        total = s["total_records"] or 0
        s["attendance_percent"] = round((s["present"] or 0) * 100 / total, 1) if total else None
    return {
        "by_student": students,
        "by_meal": repo.summary_by_meal(cur, student_id),
        "by_date": repo.summary_by_date(cur, student_id),
    }
