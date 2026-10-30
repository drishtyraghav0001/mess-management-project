from datetime import date
from typing import Literal

import oracledb
from fastapi import APIRouter, Depends

from ..db import get_conn
from ..repositories import attendance as repo
from ..schemas import AttendanceCreate, AttendanceUpdate, MealType
from ..security import ADMIN_STAFF, ANY_USER, own_student_id
from ..services import attendance as service
from ..services import crud

router = APIRouter(prefix="/api/attendance", tags=["Attendance"])


@router.get("", summary="Attendance records (students see only their own)")
def list_attendance(student_id: int | None = None, menu_id: int | None = None, date_from: date | None = None,
                    date_to: date | None = None, meal_type: MealType | None = None,
                    status: Literal["Present", "Absent"] | None = None,
                    user: dict = Depends(ANY_USER), conn: oracledb.Connection = Depends(get_conn)):
    own = own_student_id(user)
    return repo.list_attendance(conn.cursor(), own or student_id, menu_id, date_from, date_to, meal_type, status)


@router.get("/summary", summary="Attendance summary per student / meal / date (uses MEALS_ATTENDED)")
def summary(student_id: int | None = None, user: dict = Depends(ANY_USER),
            conn: oracledb.Connection = Depends(get_conn)):
    own = own_student_id(user)
    return service.summary(conn, own or student_id)


@router.post("", status_code=201, summary="Record attendance")
def create(body: AttendanceCreate, _: dict = Depends(ADMIN_STAFF), conn: oracledb.Connection = Depends(get_conn)):
    return service.create(conn, body.model_dump(exclude_unset=True))


@router.put("/{attendance_id}", summary="Update an attendance record")
def update(attendance_id: int, body: AttendanceUpdate, _: dict = Depends(ADMIN_STAFF),
           conn: oracledb.Connection = Depends(get_conn)):
    return service.update(conn, attendance_id, body.model_dump(exclude_unset=True))


@router.delete("/{attendance_id}", summary="Delete an attendance record")
def delete(attendance_id: int, _: dict = Depends(ADMIN_STAFF), conn: oracledb.Connection = Depends(get_conn)):
    return crud.delete(conn, "ATTENDANCE", attendance_id)
