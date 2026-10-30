import oracledb

from ..errors import ApiError
from ..repositories import base
from ..repositories import students as repo
from ..schema_meta import meta
from . import crud


def details(conn: oracledb.Connection, student_id: int) -> dict:
    cur = conn.cursor()
    row = base.get(cur, "STUDENT", student_id)
    if not row:
        raise ApiError(404, f"Student {student_id} not found.")
    row["total_paid"] = repo.total_paid(cur, student_id)          # TOTAL_PAID function
    row["meals_attended"] = repo.meals_attended(cur, student_id)  # MEALS_ATTENDED function
    row["related"] = repo.related_counts(cur, student_id)
    return row


def create(conn: oracledb.Connection, payload: dict) -> dict:
    status_col = meta.tables.get("STUDENT", {}).get("STATUS")
    if status_col and not payload.get("status") and not status_col.has_default:
        payload["status"] = "Active"
    return crud.create(conn, "STUDENT", payload)


def delete(conn: oracledb.Connection, student_id: int) -> dict:
    cur = conn.cursor()
    crud.ensure_exists(cur, "STUDENT", student_id)
    related = {k: v for k, v in repo.related_counts(cur, student_id).items() if v}
    try:
        return crud.delete(conn, "STUDENT", student_id)
    except oracledb.IntegrityError as exc:
        if related and "ORA-02292" in str(exc):
            names = {"payment": "payment(s)", "attendance": "attendance record(s)",
                     "complaint": "complaint(s)", "app_users": "login account(s)"}
            parts = ", ".join(f"{v} {names.get(k, k)}" for k, v in related.items())
            raise ApiError(409, f"Cannot delete student {student_id}: the database still has {parts} "
                                f"linked to this student (foreign key). Delete those records first, "
                                f"or set the student's status to Inactive instead.", "ORA-02292")
        raise
