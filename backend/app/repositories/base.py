"""Generic, parameterised SQL helpers shared by all repositories.

Only identifiers verified by schema_meta (real table/column names) are
placed in SQL text; every value is a bind variable (:name).
"""
import oracledb

from ..db import fetch_one, scalar
from ..schema_meta import PRIMARY_KEYS, meta

MAX_ID_RETRIES = 5


def next_id(cur: oracledb.Cursor, table: str) -> int:
    """Your tables have no sequences (except PAYMENT_AUDIT_SEQ), so new IDs are MAX(id)+1."""
    t = meta.ident(table)
    pk = meta.ident(table, PRIMARY_KEYS[table])
    return int(scalar(cur, f"SELECT NVL(MAX({pk}), 0) + 1 FROM {t}"))


def _is_pk_violation(exc: oracledb.IntegrityError) -> bool:
    from ..errors import _constraint
    err = exc.args[0]
    if getattr(err, "full_code", "") != "ORA-00001":
        return False
    name = _constraint(err.message)
    cons = meta.constraints.get(name) if name else None
    return cons is not None and cons.type == "P"


def insert(cur: oracledb.Cursor, table: str, data: dict) -> None:
    t = meta.ident(table)
    cols = [meta.ident(table, c) for c in data]
    binds = ", ".join(f":{i + 1}" for i in range(len(cols)))
    cur.execute(f"INSERT INTO {t} ({', '.join(cols)}) VALUES ({binds})", list(data.values()))


def insert_with_new_id(cur: oracledb.Cursor, table: str, data: dict, explicit_id: int | None = None) -> int:
    """Insert a row, generating the primary key if the caller did not give one.

    If two users save at the same moment they could get the same MAX+1,
    so on a primary-key clash we simply try again with a fresh number.
    """
    pk = PRIMARY_KEYS[table]
    if explicit_id is not None:
        insert(cur, table, {pk: explicit_id, **data})
        return explicit_id
    for attempt in range(MAX_ID_RETRIES):
        new_id = next_id(cur, table)
        try:
            insert(cur, table, {pk: new_id, **data})
            return new_id
        except oracledb.IntegrityError as exc:
            if attempt == MAX_ID_RETRIES - 1 or not _is_pk_violation(exc):
                raise
    raise RuntimeError("unreachable")


def update(cur: oracledb.Cursor, table: str, row_id: int, data: dict) -> int:
    if not data:
        return exists(cur, table, row_id)
    t = meta.ident(table)
    pk = meta.ident(table, PRIMARY_KEYS[table])
    sets = ", ".join(f"{meta.ident(table, c)} = :v{i}" for i, c in enumerate(data))
    binds = {f"v{i}": v for i, v in enumerate(data.values())}
    binds["row_id"] = row_id
    cur.execute(f"UPDATE {t} SET {sets} WHERE {pk} = :row_id", binds)
    return cur.rowcount


def delete(cur: oracledb.Cursor, table: str, row_id: int) -> int:
    t = meta.ident(table)
    pk = meta.ident(table, PRIMARY_KEYS[table])
    cur.execute(f"DELETE FROM {t} WHERE {pk} = :row_id", {"row_id": row_id})
    return cur.rowcount


def exists(cur: oracledb.Cursor, table: str, row_id: int) -> int:
    t = meta.ident(table)
    pk = meta.ident(table, PRIMARY_KEYS[table])
    return int(scalar(cur, f"SELECT COUNT(*) FROM {t} WHERE {pk} = :row_id", {"row_id": row_id}))


def get(cur: oracledb.Cursor, table: str, row_id: int) -> dict | None:
    t = meta.ident(table)
    pk = meta.ident(table, PRIMARY_KEYS[table])
    return fetch_one(cur, f"SELECT * FROM {t} WHERE {pk} = :row_id", {"row_id": row_id})
