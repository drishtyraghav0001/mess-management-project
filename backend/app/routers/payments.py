import oracledb
from fastapi import APIRouter, Depends

from ..db import get_conn
from ..errors import ApiError
from ..repositories import payments as repo
from ..schemas import PaymentCreate, PaymentStatus, PaymentStatusUpdate
from ..security import ADMIN, ANY_USER, own_student_id
from ..services import payments as service

router = APIRouter(prefix="/api/payments", tags=["Payments"])


@router.get("", summary="Payments (students see only their own)")
def list_payments(status: PaymentStatus | None = None, student_id: int | None = None, month: str | None = None,
                  search: str | None = None, user: dict = Depends(ANY_USER),
                  conn: oracledb.Connection = Depends(get_conn)):
    own = own_student_id(user)
    if user["role"] == "staff":
        raise ApiError(403, "Mess staff cannot view payments.")
    return repo.list_payments(conn.cursor(), status, own or student_id, month, search)


@router.get("/summary", summary="Totals by status and month")
def summary(_: dict = Depends(ADMIN), conn: oracledb.Connection = Depends(get_conn)):
    return service.summary(conn)


@router.get("/audit", summary="PAYMENT_AUDIT history written by PAYMENT_STATUS_AUDIT_TRG")
def audit(payment_id: int | None = None, _: dict = Depends(ADMIN), conn: oracledb.Connection = Depends(get_conn)):
    return repo.list_audit(conn.cursor(), payment_id)


@router.get("/{payment_id}", summary="One payment")
def get_payment(payment_id: int, user: dict = Depends(ANY_USER), conn: oracledb.Connection = Depends(get_conn)):
    if user["role"] == "staff":
        raise ApiError(403, "Mess staff cannot view payments.")
    row = repo.get_payment(conn.cursor(), payment_id)
    own = own_student_id(user)
    if not row or (own is not None and row["student_id"] != own):
        raise ApiError(404, f"Payment {payment_id} not found.")
    return row


@router.post("", status_code=201, summary="Add a payment via the ADD_MESS_PAYMENT procedure")
def add_payment(body: PaymentCreate, _: dict = Depends(ADMIN), conn: oracledb.Connection = Depends(get_conn)):
    return service.add_payment(conn, body.student_id, body.payment_month, body.amount)


@router.patch("/{payment_id}/status", summary="Change status (fires PAYMENT_STATUS_AUDIT_TRG)")
def change_status(payment_id: int, body: PaymentStatusUpdate, _: dict = Depends(ADMIN),
                  conn: oracledb.Connection = Depends(get_conn)):
    return service.change_status(conn, payment_id, body.payment_status)
