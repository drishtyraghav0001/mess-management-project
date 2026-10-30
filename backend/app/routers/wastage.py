from datetime import date

import oracledb
from fastapi import APIRouter, Depends

from ..db import get_conn
from ..repositories import wastage as repo
from ..schemas import WastageCreate, WastageUpdate
from ..security import ADMIN_STAFF
from ..services import crud
from ..services import wastage as service

router = APIRouter(prefix="/api/wastage", tags=["Food Wastage"])


@router.get("", summary="Wastage records with food and planned quantity")
def list_wastage(menu_item_id: int | None = None, food_id: int | None = None, date_from: date | None = None,
                 date_to: date | None = None, _: dict = Depends(ADMIN_STAFF),
                 conn: oracledb.Connection = Depends(get_conn)):
    return repo.list_wastage(conn.cursor(), menu_item_id, food_id, date_from, date_to)


@router.get("/summary", summary="Total wastage, by food item, by date and by meal")
def summary(_: dict = Depends(ADMIN_STAFF), conn: oracledb.Connection = Depends(get_conn)):
    return service.summary(conn)


@router.post("", status_code=201, summary="Add wastage (CHECK_FOOD_WASTAGE trigger validates it)")
def create(body: WastageCreate, _: dict = Depends(ADMIN_STAFF), conn: oracledb.Connection = Depends(get_conn)):
    return service.create(conn, body.model_dump(exclude_unset=True))


@router.put("/{wastage_id}", summary="Update wastage (trigger validates it again)")
def update(wastage_id: int, body: WastageUpdate, _: dict = Depends(ADMIN_STAFF),
           conn: oracledb.Connection = Depends(get_conn)):
    return service.update(conn, wastage_id, body.model_dump(exclude_unset=True))


@router.delete("/{wastage_id}", summary="Delete a wastage record")
def delete(wastage_id: int, _: dict = Depends(ADMIN_STAFF), conn: oracledb.Connection = Depends(get_conn)):
    return crud.delete(conn, "WASTAGE", wastage_id)
