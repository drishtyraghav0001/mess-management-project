from typing import Literal

import oracledb
from fastapi import APIRouter, Depends

from ..db import get_conn
from ..errors import ApiError
from ..repositories import complaints as repo
from ..schemas import ComplaintCreate, ComplaintStatusUpdate, Severity
from ..security import ADMIN, ANY_USER, own_student_id
from ..services import complaints as service
from ..services import crud

router = APIRouter(prefix="/api/complaints", tags=["Complaints"])


@router.get("", summary="Complaints (students see only their own)")
def list_complaints(severity: Severity | None = None,
                    status: Literal["Open", "In Progress", "Resolved"] | None = None,
                    student_id: int | None = None, complaint_type: str | None = None, search: str | None = None,
                    user: dict = Depends(ANY_USER), conn: oracledb.Connection = Depends(get_conn)):
    own = own_student_id(user)
    return repo.list_complaints(conn.cursor(), severity, status, own or student_id, complaint_type, search)


@router.get("/summary", summary="Counts by status, severity and type")
def summary(user: dict = Depends(ANY_USER), conn: oracledb.Connection = Depends(get_conn)):
    return repo.summary(conn.cursor(), own_student_id(user))


@router.get("/{complaint_id}", summary="One complaint")
def get_complaint(complaint_id: int, user: dict = Depends(ANY_USER), conn: oracledb.Connection = Depends(get_conn)):
    row = repo.get_complaint(conn.cursor(), complaint_id)
    own = own_student_id(user)
    if not row or (own is not None and row["student_id"] != own):
        raise ApiError(404, f"Complaint {complaint_id} not found.")
    return row


@router.post("", status_code=201, summary="Submit a complaint (students: always as themselves)")
def create(body: ComplaintCreate, user: dict = Depends(ANY_USER), conn: oracledb.Connection = Depends(get_conn)):
    return service.create(conn, body.model_dump(exclude_unset=True), own_student_id(user))


@router.post("/{complaint_id}/resolve", summary="Resolve via the RESOLVE_COMPLAINT procedure")
def resolve(complaint_id: int, _: dict = Depends(ADMIN), conn: oracledb.Connection = Depends(get_conn)):
    return service.resolve(conn, complaint_id)


@router.patch("/{complaint_id}/status", summary="Set Open / In Progress")
def change_status(complaint_id: int, body: ComplaintStatusUpdate, _: dict = Depends(ADMIN),
                  conn: oracledb.Connection = Depends(get_conn)):
    return service.change_status(conn, complaint_id, body.status)


@router.delete("/{complaint_id}", summary="Delete a complaint")
def delete(complaint_id: int, _: dict = Depends(ADMIN), conn: oracledb.Connection = Depends(get_conn)):
    return crud.delete(conn, "COMPLAINT", complaint_id)
