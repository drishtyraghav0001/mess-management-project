import oracledb
from fastapi import APIRouter, Depends

from ..db import get_conn
from ..errors import ApiError
from ..repositories import base
from ..repositories import food_items as repo
from ..schemas import FoodItemCreate, FoodItemUpdate
from ..security import ADMIN_STAFF, ANY_USER
from ..services import crud

router = APIRouter(prefix="/api/food-items", tags=["Food Items"])


@router.get("", summary="List food items (search, category, availability)")
def list_food(search: str | None = None, category: str | None = None, availability: str | None = None,
              _: dict = Depends(ANY_USER), conn: oracledb.Connection = Depends(get_conn)):
    return repo.list_food_items(conn.cursor(), search, category, availability)


@router.get("/{food_id}", summary="One food item")
def get_food(food_id: int, _: dict = Depends(ANY_USER), conn: oracledb.Connection = Depends(get_conn)):
    row = base.get(conn.cursor(), "FOOD_ITEM", food_id)
    if not row:
        raise ApiError(404, f"Food item {food_id} not found.")
    return row


@router.post("", status_code=201, summary="Add a food item")
def create_food(body: FoodItemCreate, _: dict = Depends(ADMIN_STAFF), conn: oracledb.Connection = Depends(get_conn)):
    return crud.create(conn, "FOOD_ITEM", body.model_dump(exclude_unset=True))


@router.put("/{food_id}", summary="Update a food item")
def update_food(food_id: int, body: FoodItemUpdate, _: dict = Depends(ADMIN_STAFF),
                conn: oracledb.Connection = Depends(get_conn)):
    return crud.update(conn, "FOOD_ITEM", food_id, body.model_dump(exclude_unset=True))


@router.delete("/{food_id}", summary="Delete a food item (blocked if used in a menu)")
def delete_food(food_id: int, _: dict = Depends(ADMIN_STAFF), conn: oracledb.Connection = Depends(get_conn)):
    return crud.delete(conn, "FOOD_ITEM", food_id)
