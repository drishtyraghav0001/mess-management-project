"""Turns Oracle errors into clear JSON messages with the right HTTP status."""
import logging
import re

import oracledb
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

log = logging.getLogger("mess")


class ApiError(Exception):
    def __init__(self, status_code: int, message: str, code: str | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.code = code


FRIENDLY_TABLE = {
    "PAYMENT": "payments", "ATTENDANCE": "attendance records", "COMPLAINT": "complaints",
    "MENU_ITEM": "menu items", "WASTAGE": "wastage records", "APP_USERS": "login accounts",
    "MENU": "menus", "FOOD_ITEM": "food items", "STUDENT": "students",
}


def _constraint(message: str) -> str | None:
    m = re.search(r"\(([A-Z0-9_$#]+)\.([A-Z0-9_$#]+)\)", message)
    return m.group(2) if m else None


def oracle_error_to_api(exc: oracledb.Error) -> ApiError:
    from .schema_meta import meta  # local import avoids a circular import

    err = exc.args[0] if exc.args else None
    full = getattr(err, "message", str(exc)) or str(exc)
    code = getattr(err, "full_code", "") or ""
    first_line = full.splitlines()[0] if full else str(exc)
    cname = _constraint(full)
    cons = meta.constraints.get(cname) if cname else None

    if code == "ORA-20001" or "ORA-20001" in full:
        return ApiError(400, "Wastage cannot exceed planned quantity.", "ORA-20001")
    if code.startswith("ORA-20") and code[4:].isdigit() and 20000 <= int(code[4:]) <= 20999:
        msg = re.sub(r"^ORA-\d+:\s*", "", first_line)
        return ApiError(400, msg, code)
    if code == "ORA-00001":
        if cname == "UQ_STUDENT_MONTH":
            return ApiError(409, "This student already has a payment for that month "
                                 "(UQ_STUDENT_MONTH allows one payment per student per month).", code)
        if cname == "UQ_APP_USERS_USERNAME":
            return ApiError(409, "That username is already taken.", code)
        what = f" ({', '.join(c.lower() for c in cons.columns)})" if cons and cons.columns else ""
        return ApiError(409, f"A record with the same unique value{what} already exists [{cname}].", code)
    if code == "ORA-02292":
        child = FRIENDLY_TABLE.get(cons.table, cons.table) if cons else "other tables"
        return ApiError(409, f"Cannot delete this record because related {child} still refer to it "
                             f"[{cname}]. Delete or reassign those first.", code)
    if code == "ORA-02291":
        parent = cons.ref_table if cons and cons.ref_table else "parent table"
        col = cons.columns[0].lower() if cons and cons.columns else "reference"
        return ApiError(400, f"The {col} you entered does not exist in {parent} [{cname}].", code)
    if code == "ORA-02290":
        cond = f": {cons.condition}" if cons and cons.condition else ""
        return ApiError(400, f"Value rejected by check constraint {cname}{cond}", code)
    if code == "ORA-01400":
        m = re.search(r'"([A-Z0-9_$#]+)"\)?\s*$', first_line) or re.findall(r'"([A-Z0-9_$#]+)"', first_line)
        col = (m.group(1) if hasattr(m, "group") else (m[-1] if m else "a required column")).lower()
        return ApiError(400, f"{col} is required (cannot be empty).", code)
    if code == "ORA-01407":
        cols = re.findall(r'"([A-Z0-9_$#]+)"', first_line)
        return ApiError(400, f"{(cols[-1] if cols else 'This field').lower()} cannot be empty.", code)
    if code == "ORA-12899":
        return ApiError(400, "A value is too long for its column: " + re.sub(r"^ORA-\d+:\s*", "", first_line), code)
    if code == "ORA-01403" and "CHECK_FOOD_WASTAGE" in full:
        return ApiError(400, "The selected menu item does not exist.", code)
    if code in ("ORA-01722", "ORA-01858", "ORA-01861", "ORA-01843", "ORA-01847", "ORA-01839"):
        return ApiError(400, "Invalid number or date value: " + first_line, code)
    if code in ("ORA-00942", "ORA-04043", "ORA-06550", "ORA-00904"):
        return ApiError(500, "Database object problem (check that your schema matches): " + first_line, code)
    if code.startswith("DPY-6") or code in ("ORA-12514", "ORA-12541", "ORA-12505", "ORA-01017",
                                            "ORA-03113", "ORA-03114", "DPY-4011"):
        return ApiError(503, "Cannot reach the Oracle database: " + first_line, code)
    log.exception("Unhandled Oracle error", exc_info=exc)
    return ApiError(500, "Database error: " + first_line, code or None)


async def api_error_handler(_: Request, exc: ApiError):
    body = {"detail": exc.message}
    if exc.code:
        body["oracle_code"] = exc.code
    return JSONResponse(status_code=exc.status_code, content=body)


async def oracle_error_handler(request: Request, exc: oracledb.Error):
    return await api_error_handler(request, oracle_error_to_api(exc))


async def validation_error_handler(_: Request, exc: RequestValidationError):
    problems = []
    for e in exc.errors():
        loc = [str(x) for x in e.get("loc", []) if x not in ("body", "query", "path")]
        msg = e.get("msg", "invalid").replace("Value error, ", "")
        problems.append({"field": ".".join(loc), "message": msg})
    summary = "; ".join(f"{p['field']}: {p['message']}" if p["field"] else p["message"] for p in problems)
    return JSONResponse(status_code=422, content={"detail": summary or "Invalid input.", "errors": problems})


async def runtime_error_handler(_: Request, exc: RuntimeError):
    return JSONResponse(status_code=503, content={"detail": str(exc)})
