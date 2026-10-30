import oracledb

from ..db import fetch_all
from .common import Where


def list_food_items(cur: oracledb.Cursor, search: str | None, category: str | None,
                    availability: str | None) -> list[dict]:
    w = Where()
    if search:
        w.add("(UPPER(f.FOOD_NAME) LIKE :q OR UPPER(f.CATEGORY) LIKE :q)", q=f"%{search.upper()}%")
    if category:
        w.add("f.CATEGORY = :cat", cat=category)
    if availability:
        w.add("f.AVAILABILITY = :av", av=availability)
    return fetch_all(cur, f"""
        SELECT f.*, (SELECT COUNT(*) FROM MENU_ITEM mi WHERE mi.FOOD_ID = f.FOOD_ID) AS used_in_menus
        FROM FOOD_ITEM f{w.sql()} ORDER BY f.FOOD_ID""", w.binds)
