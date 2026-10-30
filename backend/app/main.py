"""Mess Management System - FastAPI application entry point.

Run from the backend folder:
    uvicorn app.main:app --reload --port 8000
Then open http://localhost:8000/docs for the interactive API documentation.
"""
import logging
from contextlib import asynccontextmanager

import oracledb
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from . import db
from .config import settings
from .errors import ApiError, api_error_handler, oracle_error_handler, runtime_error_handler, validation_error_handler
from .routers import (attendance, auth, complaints, dashboard, food_items, menus, meta, payments, reports,
                      students, wastage)
from .schema_meta import refresh

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("mess")


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        db.init_pool()
        conn = db.acquire()
        try:
            refresh(conn)
            log.info("Connected to Oracle %s. Schema loaded.", conn.version)
        finally:
            conn.close()
    except Exception as exc:  # keep the API up so /api/health can explain the problem
        log.error("DATABASE STARTUP FAILED: %s", exc)
    yield
    db.close_pool()


app = FastAPI(
    title="Mess Management System API",
    version="1.0.0",
    description="REST API on top of the existing Oracle schema (STUDENT, MENU, FOOD_ITEM, MENU_ITEM, "
                "ATTENDANCE, PAYMENT, COMPLAINT, WASTAGE, PAYMENT_AUDIT). Click **Authorize** and log in "
                "to try the protected endpoints.",
    lifespan=lifespan,
)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

app.add_exception_handler(ApiError, api_error_handler)
app.add_exception_handler(oracledb.Error, oracle_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(RuntimeError, runtime_error_handler)

for r in (meta, auth, dashboard, students, menus, food_items, attendance, payments, complaints, wastage, reports):
    app.include_router(r.router)


@app.get("/", include_in_schema=False)
def root():
    return {"message": "Mess Management System API. Open /docs for documentation.", "health": "/api/health"}
