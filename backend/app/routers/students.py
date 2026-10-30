import oracledb
from fastapi import APIRouter, Depends, Query

from ..db import get_conn
from ..errors import ApiError
from ..repositories import students as repo
from ..schemas import StudentCreate, StudentUpdate
from ..security import ADMIN, ADMIN_STAFF, ANY_USER, own_student_id
from ..services import crud
from ..services import students as service

router = APIRouter(prefix="/api/students", tags=["Students"])


@router.get("", summary="List students (search, hostel and status filters)")
def list_students(search: str | None = None, hostel: str | None = None, status: str | None = None,
                  _: dict = Depends(ADMIN_STAFF), conn: oracledb.Connection = Depends(get_conn)):
    return repo.list_students(conn.cursor(), search, hostel, status)


@router.get("/me", summary="The logged-in student's own record")
def my_record(user: dict = Depends(ANY_USER), conn: oracledb.Connection = Depends(get_conn)):
    sid = own_student_id(user)
    if sid is None:
        raise ApiError(400, "Only student logins have a student record.")
    return service.details(conn, sid)


@router.get("/{student_id}", summary="Student details incl. TOTAL_PAID and MEALS_ATTENDED")
def get_student(student_id: int, user: dict = Depends(ANY_USER), conn: oracledb.Connection = Depends(get_conn)):
    sid = own_student_id(user)
    if sid is not None and sid != student_id:
        raise ApiError(403, "Students can only view their own record.")
    return service.details(conn, student_id)


@router.get("/{student_id}/total-paid", summary="Calls the TOTAL_PAID function")
def total_paid(student_id: int, user: dict = Depends(ANY_USER), conn: oracledb.Connection = Depends(get_conn)):
    sid = own_student_id(user)
    if sid is not None and sid != student_id:
        raise ApiError(403, "Students can only view their own total.")
    cur = conn.cursor()
    crud.ensure_exists(cur, "STUDENT", student_id)
    return {"student_id": student_id, "total_paid": repo.total_paid(cur, student_id), "function": "TOTAL_PAID"}


@router.get("/{student_id}/meals-attended", summary="Calls the MEALS_ATTENDED function")
def meals_attended(student_id: int, user: dict = Depends(ANY_USER), conn: oracledb.Connection = Depends(get_conn)):
    sid = own_student_id(user)
    if sid is not None and sid != student_id:
        raise ApiError(403, "Students can only view their own attendance.")
    cur = conn.cursor()
    crud.ensure_exists(cur, "STUDENT", student_id)
    return {"student_id": student_id, "meals_attended": repo.meals_attended(cur, student_id),
            "function": "MEALS_ATTENDED"}


@router.post("", status_code=201, summary="Add a student")
def create_student(body: StudentCreate, _: dict = Depends(ADMIN), conn: oracledb.Connection = Depends(get_conn)):
    return service.create(conn, body.model_dump(exclude_unset=True))


@router.put("/{student_id}", summary="Update a student")
def update_student(student_id: int, body: StudentUpdate, _: dict = Depends(ADMIN),
                   conn: oracledb.Connection = Depends(get_conn)):
    return crud.update(conn, "STUDENT", student_id, body.model_dump(exclude_unset=True))


@router.delete("/{student_id}", summary="Delete a student (only if no child records)")
def delete_student(student_id: int, _: dict = Depends(ADMIN), conn: oracledb.Connection = Depends(get_conn)):
    return service.delete(conn, student_id)
