from datetime import date

import oracledb
from fastapi import APIRouter, Depends

from ..db import get_conn
from ..repositories import menus as repo
from ..schemas import MealType, MenuCreate, MenuItemCreate, MenuItemUpdate, MenuUpdate
from ..security import ADMIN_STAFF, ANY_USER
from ..services import crud
from ..services import menus as service

router = APIRouter(prefix="/api", tags=["Menus & Menu Items"])


@router.get("/menus", summary="Menus with their food items (date and meal-type filters)")
def list_menus(date_from: date | None = None, date_to: date | None = None, meal_type: MealType | None = None,
               _: dict = Depends(ANY_USER), conn: oracledb.Connection = Depends(get_conn)):
    return service.list_with_items(conn, date_from, date_to, meal_type)


@router.get("/menus/{menu_id}", summary="One menu with its items")
def get_menu(menu_id: int, _: dict = Depends(ANY_USER), conn: oracledb.Connection = Depends(get_conn)):
    return service.get_with_items(conn, menu_id)


@router.post("/menus", status_code=201, summary="Add a menu")
def create_menu(body: MenuCreate, _: dict = Depends(ADMIN_STAFF), conn: oracledb.Connection = Depends(get_conn)):
    return crud.create(conn, "MENU", body.model_dump(exclude_unset=True))


@router.put("/menus/{menu_id}", summary="Update a menu")
def update_menu(menu_id: int, body: MenuUpdate, _: dict = Depends(ADMIN_STAFF),
                conn: oracledb.Connection = Depends(get_conn)):
    return crud.update(conn, "MENU", menu_id, body.model_dump(exclude_unset=True))


@router.delete("/menus/{menu_id}", summary="Delete a menu (only if nothing references it)")
def delete_menu(menu_id: int, _: dict = Depends(ADMIN_STAFF), conn: oracledb.Connection = Depends(get_conn)):
    return crud.delete(conn, "MENU", menu_id)


@router.get("/menu-items", summary="Menu items joined with food and menu date")
def list_menu_items(menu_id: int | None = None, meal_type: MealType | None = None, food_id: int | None = None,
                    date_from: date | None = None, date_to: date | None = None,
                    _: dict = Depends(ANY_USER), conn: oracledb.Connection = Depends(get_conn)):
    return repo.list_menu_items(conn.cursor(), menu_id, meal_type, food_id, date_from, date_to)


@router.post("/menu-items", status_code=201, summary="Add a food item to a menu")
def create_menu_item(body: MenuItemCreate, _: dict = Depends(ADMIN_STAFF),
                     conn: oracledb.Connection = Depends(get_conn)):
    return service.create_menu_item(conn, body.model_dump(exclude_unset=True))


@router.put("/menu-items/{item_id}", summary="Update a menu item")
def update_menu_item(item_id: int, body: MenuItemUpdate, _: dict = Depends(ADMIN_STAFF),
                     conn: oracledb.Connection = Depends(get_conn)):
    return service.update_menu_item(conn, item_id, body.model_dump(exclude_unset=True))


@router.delete("/menu-items/{item_id}", summary="Remove a menu item (only if no wastage references it)")
def delete_menu_item(item_id: int, _: dict = Depends(ADMIN_STAFF), conn: oracledb.Connection = Depends(get_conn)):
    return crud.delete(conn, "MENU_ITEM", item_id)
