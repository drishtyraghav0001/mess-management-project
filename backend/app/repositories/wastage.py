from datetime import date

import oracledb

from ..db import fetch_all, fetch_one, scalar
from .common import Where


def list_wastage(cur: oracledb.Cursor, menu_item_id: int | None = None, food_id: int | None = None,
                 date_from: date | None = None, date_to: date | None = None) -> list[dict]:
    w = Where()
    if menu_item_id:
        w.add("w.MENU_ITEM_ID = :mi", mi=menu_item_id)
    if food_id:
        w.add("mi.FOOD_ID = :fid", fid=food_id)
    if date_from:
        w.add("TRUNC(w.WASTAGE_DATE) >= :dfrom", dfrom=date_from)
    if date_to:
        w.add("TRUNC(w.WASTAGE_DATE) <= :dto", dto=date_to)
    return fetch_all(cur, f"""
        SELECT w.WASTAGE_ID, w.MENU_ITEM_ID, mi.MENU_ID, mi.MEAL_TYPE, mi.FOOD_ID, f.FOOD_NAME,
               mi.QUANTITY_PLANNED, w.WASTAGE_DATE, w.QUANTITY_WASTED, w.REASON,
               CASE WHEN mi.QUANTITY_PLANNED > 0
                    THEN ROUND(w.QUANTITY_WASTED * 100 / mi.QUANTITY_PLANNED, 1) END AS wasted_percent
        FROM WASTAGE w
        JOIN MENU_ITEM mi ON mi.MENU_ITEM_ID = w.MENU_ITEM_ID
        JOIN FOOD_ITEM f ON f.FOOD_ID = mi.FOOD_ID{w.sql()}
        ORDER BY w.WASTAGE_DATE DESC NULLS LAST, w.WASTAGE_ID DESC""", w.binds)


def menu_item_planned(cur: oracledb.Cursor, menu_item_id: int) -> dict | None:
    return fetch_one(cur, "SELECT MENU_ITEM_ID, QUANTITY_PLANNED FROM MENU_ITEM WHERE MENU_ITEM_ID = :id",
                     {"id": menu_item_id})


def total(cur: oracledb.Cursor) -> float:
    return float(scalar(cur, "SELECT NVL(SUM(QUANTITY_WASTED), 0) FROM WASTAGE") or 0)


def by_food(cur: oracledb.Cursor) -> list[dict]:
    return fetch_all(cur, """
        SELECT f.FOOD_ID, f.FOOD_NAME, f.CATEGORY,
               NVL(SUM(w.QUANTITY_WASTED), 0) AS total_wasted,
               SUM(mi.QUANTITY_PLANNED) AS total_planned,
               COUNT(w.WASTAGE_ID) AS entries
        FROM WASTAGE w
        JOIN MENU_ITEM mi ON mi.MENU_ITEM_ID = w.MENU_ITEM_ID
        JOIN FOOD_ITEM f ON f.FOOD_ID = mi.FOOD_ID
        GROUP BY f.FOOD_ID, f.FOOD_NAME, f.CATEGORY
        ORDER BY total_wasted DESC""")


def by_date(cur: oracledb.Cursor) -> list[dict]:
    return fetch_all(cur, """
        SELECT TRUNC(WASTAGE_DATE) AS wastage_date, NVL(SUM(QUANTITY_WASTED), 0) AS total_wasted,
               COUNT(*) AS entries
        FROM WASTAGE GROUP BY TRUNC(WASTAGE_DATE) ORDER BY TRUNC(WASTAGE_DATE)""")


def by_meal(cur: oracledb.Cursor) -> list[dict]:
    return fetch_all(cur, """
        SELECT mi.MEAL_TYPE, NVL(SUM(w.QUANTITY_WASTED), 0) AS total_wasted
        FROM WASTAGE w JOIN MENU_ITEM mi ON mi.MENU_ITEM_ID = w.MENU_ITEM_ID
        GROUP BY mi.MEAL_TYPE
        ORDER BY DECODE(mi.MEAL_TYPE, 'Breakfast', 1, 'Lunch', 2, 'Snack', 3, 'Dinner', 4, 5)""")
