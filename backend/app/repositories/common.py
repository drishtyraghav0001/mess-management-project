"""Small SQL-building helpers used by several repositories."""
from datetime import date

from ..schema_meta import meta


def menu_date_sql(alias: str = "m") -> str:
    """SQL expression for the menu date that works for DATE, TIMESTAMP or text columns."""
    if not meta.has_column("MENU", "MENU_DATE"):
        return "NULL"
    col = meta.require_table("MENU")["MENU_DATE"]
    if col.data_type == "DATE" or col.data_type.startswith("TIMESTAMP"):
        return f"TRUNC({alias}.MENU_DATE)"
    return f"{alias}.MENU_DATE"


def date_bind(value: date):
    """Bind value matching menu_date_sql(): a date, or ISO text for text columns."""
    col = meta.tables.get("MENU", {}).get("MENU_DATE")
    if col and not (col.data_type == "DATE" or col.data_type.startswith("TIMESTAMP")):
        return value.isoformat()
    return value


def student_col(alias: str, column: str) -> str:
    """s.HOSTEL_NAME if the column exists, otherwise NULL (so queries never break)."""
    return f"{alias}.{column}" if meta.has_column("STUDENT", column) else "NULL"


class Where:
    """Collects 'AND ...' conditions together with their bind values."""

    def __init__(self) -> None:
        self.parts: list[str] = []
        self.binds: dict = {}

    def add(self, sql: str, **binds) -> "Where":
        self.parts.append(sql)
        self.binds.update(binds)
        return self

    def sql(self) -> str:
        return (" WHERE " + " AND ".join(self.parts)) if self.parts else ""
