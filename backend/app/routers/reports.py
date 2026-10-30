import oracledb
from fastapi import APIRouter, Depends

from ..db import get_conn
from ..security import ADMIN, ADMIN_STAFF
from ..services import reports as service

router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get("/student-attendance", summary="Student-wise attendance (uses MEALS_ATTENDED)")
def student_attendance(_: dict = Depends(ADMIN), conn: oracledb.Connection = Depends(get_conn)):
    return service.student_attendance(conn)


@router.get("/payment-summary", summary="Payment totals by status, month and student (uses TOTAL_PAID)")
def payment_summary(_: dict = Depends(ADMIN), conn: oracledb.Connection = Depends(get_conn)):
    return service.payment_summary(conn)


@router.get("/pending-payments", summary="Pending/failed payments and students with no payment (NOT EXISTS)")
def pending_payments(month: str | None = None, _: dict = Depends(ADMIN),
                     conn: oracledb.Connection = Depends(get_conn)):
    return service.pending_payments(conn, month)


@router.get("/complaint-status", summary="Complaint counts and unresolved list")
def complaint_status(_: dict = Depends(ADMIN), conn: oracledb.Connection = Depends(get_conn)):
    return service.complaint_status(conn)


@router.get("/food-wastage", summary="Wastage by food, date, meal and versus planned quantity")
def food_wastage(_: dict = Depends(ADMIN_STAFF), conn: oracledb.Connection = Depends(get_conn)):
    return service.food_wastage(conn)


@router.get("/menu-food", summary="Menu-wise food information")
def menu_food(_: dict = Depends(ADMIN_STAFF), conn: oracledb.Connection = Depends(get_conn)):
    return service.menu_food(conn)
