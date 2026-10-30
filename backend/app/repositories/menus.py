from datetime import date

import oracledb

from ..db import fetch_all
from .common import Where, date_bind, menu_date_sql


def list_menus(cur: oracledb.Cursor, date_from: date | None, date_to: date | None,
               meal_type: str | None) -> list[dict]:
    d = menu_date_sql("m")
    w = Where()
    if date_from:
        w.add(f"{d} >= :dfrom", dfrom=date_bind(date_from))
    if date_to:
        w.add(f"{d} <= :dto", dto=date_bind(date_to))
    if meal_type:
        w.add("EXISTS (SELECT 1 FROM MENU_ITEM x WHERE x.MENU_ID = m.MENU_ID AND x.MEAL_TYPE = :mt)", mt=meal_type)
    return fetch_all(cur, f"""
        SELECT m.*,
               (SELECT COUNT(*) FROM MENU_ITEM x WHERE x.MENU_ID = m.MENU_ID) AS item_count,
               (SELECT NVL(SUM(x.QUANTITY_PLANNED), 0) FROM MENU_ITEM x WHERE x.MENU_ID = m.MENU_ID) AS total_planned
        FROM MENU m{w.sql()}
        ORDER BY {d} DESC NULLS LAST, m.MENU_ID DESC""", w.binds)


def list_menu_items(cur: oracledb.Cursor, menu_id: int | None = None, meal_type: str | None = None,
                    food_id: int | None = None, date_from: date | None = None,
                    date_to: date | None = None) -> list[dict]:
    d = menu_date_sql("m")
    w = Where()
    if menu_id:
        w.add("mi.MENU_ID = :menu_id", menu_id=menu_id)
    if meal_type:
        w.add("mi.MEAL_TYPE = :mt", mt=meal_type)
    if food_id:
        w.add("mi.FOOD_ID = :food_id", food_id=food_id)
    if date_from:
        w.add(f"{d} >= :dfrom", dfrom=date_bind(date_from))
    if date_to:
        w.add(f"{d} <= :dto", dto=date_bind(date_to))
    return fetch_all(cur, f"""
        SELECT mi.MENU_ITEM_ID, mi.MENU_ID, {d} AS menu_date, mi.FOOD_ID, f.FOOD_NAME, f.CATEGORY,
               f.CALORIES, f.AVAILABILITY, mi.MEAL_TYPE, mi.QUANTITY_PLANNED,
               (SELECT NVL(SUM(w.QUANTITY_WASTED), 0) FROM WASTAGE w
                 WHERE w.MENU_ITEM_ID = mi.MENU_ITEM_ID) AS total_wasted
        FROM MENU_ITEM mi
        JOIN MENU m ON m.MENU_ID = mi.MENU_ID
        JOIN FOOD_ITEM f ON f.FOOD_ID = mi.FOOD_ID{w.sql()}
        ORDER BY {d} DESC NULLS LAST, mi.MENU_ID DESC,
                 DECODE(mi.MEAL_TYPE, 'Breakfast', 1, 'Lunch', 2, 'Snack', 3, 'Dinner', 4, 5), mi.MENU_ITEM_ID""",
        w.binds)
