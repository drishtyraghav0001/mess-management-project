import oracledb

from ..errors import ApiError
from ..repositories import base
from ..repositories import payments as repo
from ..repositories import students as student_repo
from . import crud


def add_payment(conn: oracledb.Connection, student_id: int, month: str, amount: float) -> dict:
    """Adds a payment ONLY through your ADD_MESS_PAYMENT procedure."""
    cur = conn.cursor()
    crud.ensure_exists(cur, "STUDENT", student_id, "student_id")
    for attempt in range(base.MAX_ID_RETRIES):
        payment_id = base.next_id(cur, "PAYMENT")  # the procedure needs P_PAYMENT_ID from the caller
        try:
            repo.add_payment_via_procedure(cur, payment_id, student_id, month, amount)
            break
        except oracledb.IntegrityError as exc:
            # Retry only if another user took the same PAYMENT_ID; UQ_STUDENT_MONTH is reported to the user.
            if attempt == base.MAX_ID_RETRIES - 1 or not base._is_pk_violation(exc):
                raise
    conn.commit()
    payment = repo.get_payment(cur, payment_id)
    payment["total_paid"] = student_repo.total_paid(cur, student_id)
    payment["message"] = f"Payment {payment_id} added through ADD_MESS_PAYMENT."
    return payment


def change_status(conn: oracledb.Connection, payment_id: int, status: str) -> dict:
    cur = conn.cursor()
    payment = repo.get_payment(cur, payment_id)
    if not payment:
        raise ApiError(404, f"Payment {payment_id} not found.")
    if payment["payment_status"] == status:
        raise ApiError(400, f"Payment {payment_id} is already '{status}'.")
    repo.set_status(cur, payment_id, status)  # fires PAYMENT_STATUS_AUDIT_TRG
    conn.commit()
    updated = repo.get_payment(cur, payment_id)
    updated["audit"] = repo.list_audit(cur, payment_id)
    updated["message"] = (f"Status changed from {payment['payment_status']} to {status}. "
                          f"PAYMENT_STATUS_AUDIT_TRG recorded the change in PAYMENT_AUDIT.")
    return updated


def summary(conn: oracledb.Connection) -> dict:
    cur = conn.cursor()
    return {"by_status": repo.summary_by_status(cur), "by_month": repo.summary_by_month(cur),
            "months": repo.months(cur)}
