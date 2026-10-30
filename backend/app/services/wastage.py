import oracledb

from ..errors import ApiError
from ..repositories import wastage as repo
from . import crud


def _one(cur, wastage_id: int) -> dict:
    rows = [r for r in repo.list_wastage(cur) if r["wastage_id"] == wastage_id]
    return rows[0] if rows else {"wastage_id": wastage_id}


def _check_menu_item(cur, menu_item_id):
    # CHECK_FOOD_WASTAGE does SELECT ... INTO on MENU_ITEM, which fails with
    # "no data found" for an unknown item, so give a clear message first.
    if menu_item_id is not None and not repo.menu_item_planned(cur, menu_item_id):
        raise ApiError(400, f"Menu item {menu_item_id} does not exist.")


def create(conn: oracledb.Connection, payload: dict) -> dict:
    """Plain INSERT into WASTAGE - the CHECK_FOOD_WASTAGE trigger validates the quantity.

    We deliberately do NOT compare with QUANTITY_PLANNED here: the database
    trigger is the single source of that rule (ORA-20001 -> HTTP 400).
    """
    cur = conn.cursor()
    _check_menu_item(cur, payload["menu_item_id"])
    if not payload.get("wastage_date"):
        payload.pop("wastage_date", None)  # use DEFAULT SYSDATE
    row = crud.create(conn, "WASTAGE", payload)
    return _one(cur, row["wastage_id"])


def update(conn: oracledb.Connection, wastage_id: int, payload: dict) -> dict:
    cur = conn.cursor()
    crud.ensure_exists(cur, "WASTAGE", wastage_id)
    _check_menu_item(cur, payload.get("menu_item_id"))
    crud.update(conn, "WASTAGE", wastage_id, payload)  # trigger also runs on UPDATE
    return _one(cur, wastage_id)


def summary(conn: oracledb.Connection) -> dict:
    cur = conn.cursor()
    return {"total_wasted": repo.total(cur), "by_food": repo.by_food(cur),
            "by_date": repo.by_date(cur), "by_meal": repo.by_meal(cur)}


def not_found(wastage_id: int):
    raise ApiError(404, f"Wastage record {wastage_id} not found.")
