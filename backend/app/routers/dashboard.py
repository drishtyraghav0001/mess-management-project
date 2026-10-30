import oracledb
from fastapi import APIRouter, Depends

from ..db import get_conn
from ..security import ADMIN_STAFF, ANY_USER, own_student_id
from ..services import dashboard as service

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("", summary="Admin / staff dashboard: live counts, charts and recent activity")
def stats(user: dict = Depends(ADMIN_STAFF), conn: oracledb.Connection = Depends(get_conn)):
    return service.admin_stats(conn, include_payments=user["role"] == "admin")


@router.get("/me", summary="Student dashboard (own data only)")
def my_stats(user: dict = Depends(ANY_USER), conn: oracledb.Connection = Depends(get_conn)):
    sid = own_student_id(user)
    if sid is None:
        return service.admin_stats(conn, include_payments=user["role"] == "admin")
    return service.student_stats(conn, sid)
