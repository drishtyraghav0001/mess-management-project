import oracledb

from ..errors import ApiError
from ..repositories import complaints as repo
from . import crud


def create(conn: oracledb.Connection, payload: dict, forced_student_id: int | None) -> dict:
    cur = conn.cursor()
    if forced_student_id is not None:
        payload["student_id"] = forced_student_id  # students can only complain as themselves
    if not payload.get("student_id"):
        raise ApiError(400, "student_id is required.")
    crud.ensure_exists(cur, "STUDENT", payload["student_id"], "student_id")
    crud.ensure_exists(cur, "MENU", payload.get("menu_id"), "menu_id")
    payload.pop("status", None)          # new complaints use the table default ('Open')
    payload.pop("complaint_date", None)  # and DEFAULT SYSDATE
    row = crud.create(conn, "COMPLAINT", payload)
    return repo.get_complaint(cur, row["complaint_id"])


def resolve(conn: oracledb.Connection, complaint_id: int) -> dict:
    cur = conn.cursor()
    complaint = repo.get_complaint(cur, complaint_id)
    # RESOLVE_COMPLAINT only prints "not found" with DBMS_OUTPUT, so we check first.
    if not complaint:
        raise ApiError(404, f"Complaint {complaint_id} not found.")
    if complaint["status"] == "Resolved":
        raise ApiError(400, f"Complaint {complaint_id} is already resolved.")
    repo.resolve_via_procedure(cur, complaint_id)
    conn.commit()
    result = repo.get_complaint(cur, complaint_id)
    result["message"] = f"Complaint {complaint_id} resolved using RESOLVE_COMPLAINT."
    return result


def change_status(conn: oracledb.Connection, complaint_id: int, status: str) -> dict:
    cur = conn.cursor()
    if not repo.get_complaint(cur, complaint_id):
        raise ApiError(404, f"Complaint {complaint_id} not found.")
    repo.set_status(cur, complaint_id, status)
    conn.commit()
    return repo.get_complaint(cur, complaint_id)
