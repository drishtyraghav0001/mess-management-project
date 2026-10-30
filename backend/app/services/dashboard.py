import oracledb

from ..errors import ApiError
from ..repositories import attendance as att_repo
from ..repositories import base
from ..repositories import complaints as comp_repo
from ..repositories import menus as menu_repo
from ..repositories import payments as pay_repo
from ..repositories import reports as rep
from ..repositories import students as stu_repo
from ..repositories import wastage as waste_repo
from ..schema_meta import meta


def admin_stats(conn: oracledb.Connection, include_payments: bool = True) -> dict:
    """Every number here is calculated from the live tables."""
    cur = conn.cursor()
    status_rows = pay_repo.summary_by_status(cur)
    pay = {r["status"]: r for r in status_rows}
    comp = comp_repo.summary(cur)
    comp_status = {r["status"]: r["count"] for r in comp["by_status"]}
    active = (rep.count(cur, "STUDENT", "WHERE STATUS = 'Active'")
              if meta.has_column("STUDENT", "STATUS") else None)
    att_by_meal = att_repo.summary_by_meal(cur)
    present = sum(r["present"] or 0 for r in att_by_meal)
    absent = sum(r["absent"] or 0 for r in att_by_meal)
    result = {
        "cards": {
            "total_students": rep.count(cur, "STUDENT"),
            "active_students": active,
            "total_food_items": rep.count(cur, "FOOD_ITEM"),
            "available_food_items": rep.count(cur, "FOOD_ITEM", "WHERE AVAILABILITY = 'Available'"),
            "total_menus": rep.count(cur, "MENU"),
            "total_payments": sum(r["count"] for r in status_rows),
            "paid_payments": pay.get("Paid", {}).get("count", 0),
            "paid_amount": pay.get("Paid", {}).get("amount", 0),
            "pending_payments": pay.get("Pending", {}).get("count", 0),
            "pending_amount": pay.get("Pending", {}).get("amount", 0),
            "failed_payments": pay.get("Failed", {}).get("count", 0),
            "total_complaints": sum(comp_status.values()),
            "open_complaints": comp_status.get("Open", 0) + comp_status.get("In Progress", 0),
            "resolved_complaints": comp_status.get("Resolved", 0),
            "total_wastage": waste_repo.total(cur),
            "wastage_entries": rep.count(cur, "WASTAGE"),
            "attendance_present": present,
            "attendance_absent": absent,
            "audit_entries": rep.count(cur, "PAYMENT_AUDIT"),
        },
        "charts": {
            "payment_status": status_rows,
            "attendance_by_meal": att_by_meal,
            "attendance_by_date": att_repo.summary_by_date(cur),
            "wastage_by_food": waste_repo.by_food(cur),
            "wastage_by_date": waste_repo.by_date(cur),
            "complaints_by_severity": comp["by_severity"],
            "complaints_by_status": comp["by_status"],
        },
        "recent_payments": pay_repo.list_payments(cur)[:6],
        "recent_complaints": comp_repo.list_complaints(cur)[:6],
    }
    if not include_payments:  # mess staff are not allowed to see payment data
        for key in ("total_payments", "paid_payments", "paid_amount", "pending_payments", "pending_amount",
                    "failed_payments", "audit_entries"):
            result["cards"].pop(key, None)
        result["charts"].pop("payment_status", None)
        result.pop("recent_payments", None)
    return result


def student_stats(conn: oracledb.Connection, student_id: int) -> dict:
    cur = conn.cursor()
    student = base.get(cur, "STUDENT", student_id)
    if not student:
        raise ApiError(404, "Your student record was not found.")
    payments = pay_repo.list_payments(cur, student_id=student_id)
    complaints = comp_repo.list_complaints(cur, student_id=student_id)
    attendance = att_repo.list_attendance(cur, student_id=student_id)
    menus = menu_repo.list_menus(cur, None, None, None)[:3]
    items = menu_repo.list_menu_items(cur)
    for m in menus:
        m["items"] = [i for i in items if i["menu_id"] == m["menu_id"]]
    return {
        "student": student,
        "cards": {
            "total_paid": stu_repo.total_paid(cur, student_id),          # TOTAL_PAID
            "meals_attended": stu_repo.meals_attended(cur, student_id),  # MEALS_ATTENDED
            "attendance_records": len(attendance),
            "pending_payments": sum(1 for p in payments if p["payment_status"] == "Pending"),
            "pending_amount": sum(p["amount"] or 0 for p in payments if p["payment_status"] == "Pending"),
            "open_complaints": sum(1 for c in complaints if c["status"] != "Resolved"),
            "total_complaints": len(complaints),
        },
        "attendance_by_meal": att_repo.summary_by_meal(cur, student_id),
        "recent_attendance": attendance[:6],
        "recent_payments": payments[:6],
        "recent_complaints": complaints[:6],
        "latest_menus": menus,
    }
