import oracledb
from fastapi import APIRouter, Depends

from .. import db
from ..config import settings
from ..db import get_conn, scalar
from ..errors import ApiError
from ..schema_meta import meta, refresh
from ..security import ADMIN, ANY_USER

router = APIRouter(prefix="/api", tags=["System"])


@router.get("/health", summary="Is the API up and can it reach Oracle? (no login needed)")
def health():
    if not db.pool_ready():
        return {"api": "ok", "database": "not connected", "detail": "See the backend console for the error."}
    try:
        conn = db.acquire()
        try:
            version = conn.version
            student_count = scalar(conn.cursor(), "SELECT COUNT(*) FROM STUDENT")
        finally:
            conn.close()
        return {"api": "ok", "database": "connected", "oracle_version": version, "dsn": settings.db_dsn,
                "user": settings.db_user, "students": student_count, "warnings": meta.warnings,
                "logins_enabled": meta.has_table("APP_USERS")}
    except oracledb.Error as exc:
        return {"api": "ok", "database": "error", "detail": str(exc).splitlines()[0]}


@router.get("/meta/columns/{table}", summary="Real columns of STUDENT or MENU (used to build forms)")
def columns(table: str, _: dict = Depends(ANY_USER)):
    table = table.upper()
    if table not in ("STUDENT", "MENU", "FOOD_ITEM", "MENU_ITEM", "ATTENDANCE", "PAYMENT", "COMPLAINT", "WASTAGE"):
        raise ApiError(404, "Unknown table.")
    return [c.to_json() for c in meta.columns(table)]


@router.get("/meta/schema-check", summary="Which tables / procedures / functions / triggers were found")
def schema_check(_: dict = Depends(ADMIN), conn: oracledb.Connection = Depends(get_conn)):
    refresh(conn)
    return meta.report()
