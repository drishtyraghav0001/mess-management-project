"""Reads the REAL schema from Oracle's data dictionary at startup.

The application never guesses column names: every column name that is put
into a SQL statement is checked against USER_TAB_COLUMNS first. Values are
always passed as bind variables, never pasted into the SQL text.
"""
import logging
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

import oracledb

from .errors import ApiError

log = logging.getLogger("mess")

PROJECT_TABLES = ["STUDENT", "MENU", "FOOD_ITEM", "MENU_ITEM", "ATTENDANCE",
                  "PAYMENT", "COMPLAINT", "WASTAGE", "PAYMENT_AUDIT", "APP_USERS"]
PRIMARY_KEYS = {
    "STUDENT": "STUDENT_ID", "MENU": "MENU_ID", "FOOD_ITEM": "FOOD_ID",
    "MENU_ITEM": "MENU_ITEM_ID", "ATTENDANCE": "ATTENDANCE_ID", "PAYMENT": "PAYMENT_ID",
    "COMPLAINT": "COMPLAINT_ID", "WASTAGE": "WASTAGE_ID", "PAYMENT_AUDIT": "AUDIT_ID",
    "APP_USERS": "USER_ID",
}
EXPECTED_PROGRAMS = {
    "ADD_MESS_PAYMENT": ("PROCEDURE", ["P_PAYMENT_ID", "P_STUDENT_ID", "P_PAYMENT_MONTH", "P_AMOUNT"]),
    "RESOLVE_COMPLAINT": ("PROCEDURE", ["P_COMPLAINT_ID"]),
    "TOTAL_PAID": ("FUNCTION", ["P_STUDENT_ID"]),
    "MEALS_ATTENDED": ("FUNCTION", ["P_STUDENT_ID"]),
    "PAYMENT_STATUS_AUDIT_TRG": ("TRIGGER", []),
    "CHECK_FOOD_WASTAGE": ("TRIGGER", []),
    "PAYMENT_AUDIT_SEQ": ("SEQUENCE", []),
}
_IDENT = re.compile(r"^[A-Z][A-Z0-9_$#]{0,127}$")


@dataclass
class Column:
    name: str
    data_type: str
    data_length: int | None
    precision: int | None
    scale: int | None
    nullable: bool
    has_default: bool
    position: int

    def to_json(self) -> dict:
        return {
            "name": self.name.lower(), "data_type": self.data_type, "length": self.data_length,
            "precision": self.precision, "scale": self.scale, "nullable": self.nullable,
            "has_default": self.has_default,
        }


@dataclass
class Constraint:
    name: str
    type: str
    table: str
    condition: str | None
    columns: list[str] = field(default_factory=list)
    ref_table: str | None = None


@dataclass
class SchemaMeta:
    tables: dict[str, dict[str, Column]] = field(default_factory=dict)
    constraints: dict[str, Constraint] = field(default_factory=dict)
    programs: dict[str, dict] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    loaded: bool = False

    # ---------- lookups ----------
    def has_table(self, table: str) -> bool:
        return table in self.tables

    def require_table(self, table: str) -> dict[str, Column]:
        if table not in self.tables:
            hint = " Run database/01_app_users.sql first." if table == "APP_USERS" else ""
            raise ApiError(503, f"Table {table} was not found in your Oracle schema.{hint}")
        return self.tables[table]

    def has_column(self, table: str, column: str) -> bool:
        return column.upper() in self.tables.get(table, {})

    def columns(self, table: str) -> list[Column]:
        return sorted(self.require_table(table).values(), key=lambda c: c.position)

    def ident(self, table: str, column: str | None = None) -> str:
        """Return a verified identifier that is safe to place in SQL text."""
        cols = self.require_table(table)
        name = (column or table).upper()
        if not _IDENT.match(name) or (column is not None and name not in cols):
            raise ApiError(500, f"Unknown column {table}.{name}")
        return name

    def pk_constraint_names(self) -> set[str]:
        return {c.name for c in self.constraints.values() if c.type == "P"}

    # ---------- value conversion ----------
    def coerce(self, table: str, column: str, value: Any) -> Any:
        col = self.require_table(table)[column.upper()]
        if value is None or (isinstance(value, str) and value.strip() == ""):
            return None
        t = col.data_type
        try:
            if t == "NUMBER" or t.startswith("FLOAT") or t.startswith("BINARY"):
                if isinstance(value, bool):
                    raise ValueError
                num = float(value)
                return int(num) if num.is_integer() and (col.scale in (None, 0)) else num
            if t == "DATE" or t.startswith("TIMESTAMP"):
                if isinstance(value, datetime):
                    return value
                if isinstance(value, date):
                    return datetime(value.year, value.month, value.day)
                text = str(value).strip().replace("T", " ")
                for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
                    try:
                        return datetime.strptime(text[:19], fmt)
                    except ValueError:
                        continue
                raise ValueError
        except (TypeError, ValueError):
            raise ApiError(400, f"Invalid value for {column.lower()}: expected "
                                f"{'a number' if t == 'NUMBER' else 'a date (YYYY-MM-DD)' if t == 'DATE' else t}.")
        text = str(value).strip()
        if col.data_length and t in ("VARCHAR2", "CHAR", "NVARCHAR2", "NCHAR") and len(text) > col.data_length:
            raise ApiError(400, f"{column.lower()} can be at most {col.data_length} characters.")
        return text

    def writable(self, table: str, data: dict, exclude: set[str] | None = None) -> dict:
        """Keep only keys that are real columns of the table, converted to the right type."""
        cols = self.require_table(table)
        exclude = {e.upper() for e in (exclude or set())}
        out = {}
        for key, value in data.items():
            name = str(key).upper()
            if name in cols and name not in exclude and _IDENT.match(name):
                out[name] = self.coerce(table, name, value)
        return out

    def report(self) -> dict:
        return {
            "tables": {t: [c.to_json() for c in self.columns(t)] for t in self.tables},
            "missing_tables": [t for t in PROJECT_TABLES if t not in self.tables],
            "programs": self.programs,
            "warnings": self.warnings,
        }


meta = SchemaMeta()


def load_schema(conn: oracledb.Connection) -> SchemaMeta:
    m = SchemaMeta()
    cur = conn.cursor()
    binds = {f"t{i}": t for i, t in enumerate(PROJECT_TABLES)}
    in_list = ", ".join(f":t{i}" for i in range(len(PROJECT_TABLES)))

    cur.execute(f"""
        SELECT table_name, column_name, data_type, data_length, data_precision, data_scale,
               nullable, CASE WHEN data_default IS NULL THEN 0 ELSE 1 END, column_id
        FROM user_tab_columns WHERE table_name IN ({in_list}) ORDER BY table_name, column_id""", binds)
    for t, c, dt, ln, pr, sc, nl, dflt, pos in cur:
        m.tables.setdefault(t, {})[c] = Column(c, dt, ln, pr, sc, nl == "Y", bool(dflt), pos)

    cur.execute(f"""
        SELECT c.constraint_name, c.constraint_type, c.table_name, c.search_condition, r.table_name
        FROM user_constraints c
        LEFT JOIN user_constraints r ON r.constraint_name = c.r_constraint_name
        WHERE c.table_name IN ({in_list})""", binds)
    for name, ctype, table, cond, ref in cur:
        m.constraints[name] = Constraint(name, ctype, table, cond, [], ref)
    cur.execute(f"""SELECT constraint_name, column_name FROM user_cons_columns
                    WHERE table_name IN ({in_list}) ORDER BY position""", binds)
    for name, col in cur:
        if name in m.constraints:
            m.constraints[name].columns.append(col)

    cur.execute("""SELECT object_name, object_type, status FROM user_objects
                   WHERE object_type IN ('PROCEDURE','FUNCTION','TRIGGER','SEQUENCE')""")
    found = {n: (t, s) for n, t, s in cur}
    cur.execute("""SELECT object_name, argument_name FROM user_arguments
                   WHERE package_name IS NULL AND argument_name IS NOT NULL
                   ORDER BY object_name, position""")
    args: dict[str, list[str]] = {}
    for obj, arg in cur:
        args.setdefault(obj, []).append(arg)

    for name, (otype, expected_args) in EXPECTED_PROGRAMS.items():
        info = {"type": otype, "found": name in found, "status": found.get(name, (None, None))[1],
                "expected_args": expected_args, "actual_args": args.get(name, [])}
        m.programs[name] = info
        if not info["found"]:
            m.warnings.append(f"{otype} {name} was not found in your schema.")
        elif info["status"] != "VALID":
            m.warnings.append(f"{otype} {name} is {info['status']} - recompile it in SQL*Plus.")
        elif expected_args and info["actual_args"] != expected_args:
            m.warnings.append(f"{name} parameters are {info['actual_args']}, expected {expected_args}.")

    for table in PROJECT_TABLES:
        if table not in m.tables:
            m.warnings.append(f"Table {table} not found."
                              + (" Run database/01_app_users.sql to enable logins." if table == "APP_USERS" else ""))
        elif PRIMARY_KEYS[table] not in m.tables[table]:
            m.warnings.append(f"Table {table} has no column {PRIMARY_KEYS[table]}.")
    m.loaded = True
    cur.close()
    return m


def refresh(conn: oracledb.Connection) -> SchemaMeta:
    new = load_schema(conn)
    meta.tables, meta.constraints = new.tables, new.constraints
    meta.programs, meta.warnings, meta.loaded = new.programs, new.warnings, True
    for w in meta.warnings:
        log.warning("Schema check: %s", w)
    return meta
