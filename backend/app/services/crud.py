"""Shared create/update/delete logic with 404 handling and commit."""
import oracledb

from ..errors import ApiError
from ..repositories import base
from ..schema_meta import PRIMARY_KEYS, meta

LABEL = {"STUDENT": "Student", "MENU": "Menu", "FOOD_ITEM": "Food item", "MENU_ITEM": "Menu item",
         "ATTENDANCE": "Attendance record", "PAYMENT": "Payment", "COMPLAINT": "Complaint",
         "WASTAGE": "Wastage record"}


def ensure_exists(cur: oracledb.Cursor, table: str, row_id: int | None, field: str | None = None) -> None:
    if row_id is None:
        return
    if not base.exists(cur, table, row_id):
        if field:
            raise ApiError(400, f"{LABEL[table]} with {field} {row_id} does not exist.")
        raise ApiError(404, f"{LABEL[table]} {row_id} not found.")


def create(conn: oracledb.Connection, table: str, payload: dict) -> dict:
    pk = PRIMARY_KEYS[table]
    explicit = payload.get(pk.lower())
    data = meta.writable(table, payload, exclude={pk})
    cur = conn.cursor()
    new_id = base.insert_with_new_id(cur, table, data, explicit_id=explicit)
    conn.commit()
    return base.get(cur, table, new_id)


def update(conn: oracledb.Connection, table: str, row_id: int, payload: dict) -> dict:
    pk = PRIMARY_KEYS[table]
    data = meta.writable(table, payload, exclude={pk})
    cur = conn.cursor()
    ensure_exists(cur, table, row_id)
    if not data:
        raise ApiError(400, "Nothing to update: no valid fields were sent.")
    base.update(cur, table, row_id, data)
    conn.commit()
    return base.get(cur, table, row_id)


def delete(conn: oracledb.Connection, table: str, row_id: int) -> dict:
    cur = conn.cursor()
    ensure_exists(cur, table, row_id)
    base.delete(cur, table, row_id)  # ORA-02292 (child rows exist) becomes a clear 409 message
    conn.commit()
    return {"deleted": True, "id": row_id, "message": f"{LABEL[table]} {row_id} deleted."}
