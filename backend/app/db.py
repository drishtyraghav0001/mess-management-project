"""Oracle connection pool (python-oracledb) and small row helpers."""
import logging
from datetime import date, datetime
from typing import Any, Iterator

import oracledb

from .config import settings

log = logging.getLogger("mess")
_pool: oracledb.ConnectionPool | None = None


def init_pool() -> None:
    """Create the connection pool. Called once when the API starts."""
    global _pool
    missing = settings.missing_db_settings()
    if missing:
        raise RuntimeError(f"Missing in .env: {', '.join(missing)}")
    if settings.oracle_thick_mode:
        # Needed only for very old Oracle versions (see README, "Thick mode").
        oracledb.init_oracle_client(lib_dir=settings.oracle_client_lib_dir)
    _pool = oracledb.create_pool(
        user=settings.db_user,
        password=settings.db_password,
        dsn=settings.db_dsn,
        min=settings.db_pool_min,
        max=settings.db_pool_max,
        increment=1,
        getmode=oracledb.POOL_GETMODE_TIMEDWAIT,
        wait_timeout=10000,
    )
    log.info("Oracle pool created for %s@%s", settings.db_user, settings.db_dsn)


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close(force=True)
        _pool = None


def pool_ready() -> bool:
    return _pool is not None


def acquire() -> oracledb.Connection:
    if _pool is None:
        raise RuntimeError("Database pool is not initialised. Check the backend console for the startup error.")
    return _pool.acquire()


def get_conn() -> Iterator[oracledb.Connection]:
    """FastAPI dependency: one connection per request.

    Services call conn.commit() after a successful change. Anything that was
    not committed (for example because an error was raised) is rolled back
    here before the connection goes back to the pool.
    """
    conn = acquire()
    try:
        yield conn
    finally:
        try:
            conn.rollback()
        except oracledb.Error:
            pass
        _pool.release(conn)


def _clean(value: Any) -> Any:
    if isinstance(value, datetime):
        if value.hour == value.minute == value.second == value.microsecond == 0:
            return value.date().isoformat()
        return value.isoformat(sep=" ", timespec="seconds")
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def fetch_all(cur: oracledb.Cursor, sql: str, params: dict | list | None = None) -> list[dict]:
    """Run a query and return rows as dicts with lower-case keys."""
    cur.execute(sql, params or {})
    cols = [d[0].lower() for d in cur.description]
    return [{c: _clean(v) for c, v in zip(cols, row)} for row in cur.fetchall()]


def fetch_one(cur: oracledb.Cursor, sql: str, params: dict | list | None = None) -> dict | None:
    rows = fetch_all(cur, sql, params)
    return rows[0] if rows else None


def scalar(cur: oracledb.Cursor, sql: str, params: dict | list | None = None) -> Any:
    cur.execute(sql, params or {})
    row = cur.fetchone()
    return _clean(row[0]) if row else None
