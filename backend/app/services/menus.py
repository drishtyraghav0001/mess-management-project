from datetime import date

import oracledb

from ..errors import ApiError
from ..repositories import base
from ..repositories import menus as repo
from . import crud


def list_with_items(conn: oracledb.Connection, date_from: date | None, date_to: date | None,
                    meal_type: str | None) -> list[dict]:
    cur = conn.cursor()
    menus = repo.list_menus(cur, date_from, date_to, meal_type)
    items = repo.list_menu_items(cur, meal_type=meal_type, date_from=date_from, date_to=date_to)
    by_menu: dict[int, list] = {}
    for it in items:
        by_menu.setdefault(it["menu_id"], []).append(it)
    for m in menus:
        m["items"] = by_menu.get(m["menu_id"], [])
    return menus


def get_with_items(conn: oracledb.Connection, menu_id: int) -> dict:
    cur = conn.cursor()
    menu = base.get(cur, "MENU", menu_id)
    if not menu:
        raise ApiError(404, f"Menu {menu_id} not found.")
    menu["items"] = repo.list_menu_items(cur, menu_id=menu_id)
    return menu


def create_menu_item(conn: oracledb.Connection, payload: dict) -> dict:
    cur = conn.cursor()
    crud.ensure_exists(cur, "MENU", payload.get("menu_id"), "menu_id")
    crud.ensure_exists(cur, "FOOD_ITEM", payload.get("food_id"), "food_id")
    row = crud.create(conn, "MENU_ITEM", payload)
    return _item(cur, row["menu_item_id"])


def update_menu_item(conn: oracledb.Connection, item_id: int, payload: dict) -> dict:
    cur = conn.cursor()
    crud.ensure_exists(cur, "MENU", payload.get("menu_id"), "menu_id")
    crud.ensure_exists(cur, "FOOD_ITEM", payload.get("food_id"), "food_id")
    crud.update(conn, "MENU_ITEM", item_id, payload)
    return _item(cur, item_id)


def _item(cur: oracledb.Cursor, item_id: int) -> dict:
    rows = [r for r in repo.list_menu_items(cur) if r["menu_item_id"] == item_id]
    return rows[0] if rows else {"menu_item_id": item_id}
