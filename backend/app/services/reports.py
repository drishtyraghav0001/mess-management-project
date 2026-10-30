import oracledb

from ..repositories import complaints as comp_repo
from ..repositories import menus as menu_repo
from ..repositories import payments as pay_repo
from ..repositories import reports as rep
from ..repositories import wastage as waste_repo
from . import attendance as att_service


def student_attendance(conn: oracledb.Connection) -> dict:
    return att_service.summary(conn, None)


def payment_summary(conn: oracledb.Connection) -> dict:
    cur = conn.cursor()
    return {"by_status": pay_repo.summary_by_status(cur), "by_month": pay_repo.summary_by_month(cur),
            "by_student": rep.payment_by_student(cur)}


def pending_payments(conn: oracledb.Connection, month: str | None) -> dict:
    cur = conn.cursor()
    months = pay_repo.months(cur)
    month = month or (months[0] if months else None)
    return {
        "pending": pay_repo.list_payments(cur, status="Pending"),
        "failed": pay_repo.list_payments(cur, status="Failed"),
        "month": month,
        "months": months,
        "students_without_payment": rep.students_without_payment(cur, month) if month else [],
    }


def complaint_status(conn: oracledb.Connection) -> dict:
    cur = conn.cursor()
    data = comp_repo.summary(cur)
    data["unresolved"] = rep.high_open_complaints(cur)
    return data


def food_wastage(conn: oracledb.Connection) -> dict:
    cur = conn.cursor()
    return {"total_wasted": waste_repo.total(cur), "by_food": waste_repo.by_food(cur),
            "by_date": waste_repo.by_date(cur), "by_meal": waste_repo.by_meal(cur),
            "vs_planned": rep.wastage_vs_planned(cur)}


def menu_food(conn: oracledb.Connection) -> list[dict]:
    cur = conn.cursor()
    menus = menu_repo.list_menus(cur, None, None, None)
    items = menu_repo.list_menu_items(cur)
    for m in menus:
        m["items"] = [i for i in items if i["menu_id"] == m["menu_id"]]
        m["total_calories"] = sum((i["calories"] or 0) for i in m["items"])
        m["meal_types"] = sorted({i["meal_type"] for i in m["items"]})
    return menus
