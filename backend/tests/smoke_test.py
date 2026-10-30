"""End-to-end API test for the Mess Management System.

Start the backend first (uvicorn app.main:app --port 8000), then run:

    python tests/smoke_test.py --readonly           # SAFE on your real database: only reads
    python tests/smoke_test.py                      # full test: also inserts/updates/deletes

The full test creates its own temporary rows (a test student, food item,
menu, menu item, attendance, complaint and wastage) and deletes them again
at the end. Two things cannot be undone through the app and are left
behind on purpose: one payment added through ADD_MESS_PAYMENT and the
PAYMENT_AUDIT rows written by the trigger. Run the full test on a test
database, or be happy to keep those rows.

Login details are read from environment variables (defaults shown):
  MESS_API=http://localhost:8000
  ADMIN_USER=admin   ADMIN_PASS=...   STAFF_USER=staff   STAFF_PASS=...
  STUDENT_USER=aarav STUDENT_PASS=...
"""
import argparse
import os
import sys
import time

import requests

API = os.getenv("MESS_API", "http://localhost:8000")
RESULTS: list[tuple[bool, str]] = []


def check(ok: bool, label: str, detail: str = "") -> bool:
    RESULTS.append((ok, label))
    print(f"  [{'PASS' if ok else 'FAIL'}] {label}" + (f"  -> {detail}" if detail and not ok else ""))
    return ok


class Client:
    def __init__(self, token: str | None = None):
        self.h = {"Authorization": f"Bearer {token}"} if token else {}

    def req(self, method: str, path: str, **kw):
        return requests.request(method, API + path, headers=self.h, timeout=30, **kw)

    def get(self, p, **kw): return self.req("GET", p, **kw)
    def post(self, p, **kw): return self.req("POST", p, **kw)
    def put(self, p, **kw): return self.req("PUT", p, **kw)
    def patch(self, p, **kw): return self.req("PATCH", p, **kw)
    def delete(self, p, **kw): return self.req("DELETE", p, **kw)


def login(user: str, pw: str) -> Client:
    r = requests.post(API + "/api/auth/login", json={"username": user, "password": pw}, timeout=30)
    check(r.status_code == 200, f"login as {user}", r.text)
    return Client(r.json().get("access_token") if r.ok else None)


def section(title: str):
    print(f"\n== {title} ==")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--readonly", action="store_true", help="only run read-only checks")
    args = ap.parse_args()

    section("Health")
    h = requests.get(API + "/api/health", timeout=30).json()
    check(h.get("database") == "connected", "API reaches Oracle", str(h))
    check(not h.get("warnings"), "schema check has no warnings", str(h.get("warnings")))

    section("Authentication")
    admin = login(os.getenv("ADMIN_USER", "admin"), os.getenv("ADMIN_PASS", "Admin@123"))
    staff = login(os.getenv("STAFF_USER", "staff"), os.getenv("STAFF_PASS", "Staff@123"))
    student = login(os.getenv("STUDENT_USER", "aarav"), os.getenv("STUDENT_PASS", "Student@123"))
    r = requests.post(API + "/api/auth/login", json={"username": "admin", "password": "wrong-password"})
    check(r.status_code == 401, "wrong password is rejected (401)")
    check(Client().get("/api/students").status_code == 401, "no token -> 401")
    check(Client("not-a-real-token").get("/api/students").status_code == 401, "fake token -> 401")
    me = student.get("/api/auth/me").json()
    my_id = me.get("student_id")
    check(me.get("role") == "student" and my_id is not None, "student /me returns linked STUDENT_ID")

    section("Role enforcement on the backend")
    check(student.get("/api/students").status_code == 403, "student cannot list all students")
    check(student.post("/api/payments", json={"student_id": my_id, "payment_month": "January 2030",
                                              "amount": 1}).status_code == 403, "student cannot add payments")
    check(staff.get("/api/payments").status_code == 403, "staff cannot view payments")
    check(staff.post("/api/students", json={"student_name": "X Y"}).status_code == 403, "staff cannot add students")
    check(student.get("/api/wastage").status_code == 403, "student cannot view wastage")
    check(student.get("/api/reports/payment-summary").status_code == 403, "student cannot open reports")
    check(staff.get("/api/reports/payment-summary").status_code == 403, "staff cannot open payment reports")
    check(staff.get("/api/wastage").status_code == 200, "staff can view wastage")
    check(student.get("/api/menus").status_code == 200, "student can view menus")
    other = next((s["student_id"] for s in admin.get("/api/students").json() if s["student_id"] != my_id), None)
    if other:
        check(student.get(f"/api/students/{other}").status_code == 403, "student cannot open another student")
    pays = student.get("/api/payments").json()
    check(all(p["student_id"] == my_id for p in pays), "student sees only own payments")
    att = student.get("/api/attendance").json()
    check(all(a["student_id"] == my_id for a in att), "student sees only own attendance")
    comps = student.get("/api/complaints").json()
    check(all(c["student_id"] == my_id for c in comps), "student sees only own complaints")

    section("Read endpoints")
    for path in ["/api/dashboard", "/api/students", "/api/students?search=a", "/api/menus", "/api/menu-items",
                 "/api/food-items", "/api/attendance", "/api/attendance/summary", "/api/payments",
                 "/api/payments/summary", "/api/payments/audit", "/api/complaints", "/api/complaints/summary",
                 "/api/wastage", "/api/wastage/summary", "/api/reports/student-attendance",
                 "/api/reports/payment-summary", "/api/reports/pending-payments", "/api/reports/complaint-status",
                 "/api/reports/food-wastage", "/api/reports/menu-food", "/api/meta/columns/STUDENT",
                 "/api/meta/columns/MENU", "/api/meta/schema-check"]:
        r = admin.get(path)
        check(r.status_code == 200, f"GET {path}", r.text[:200])
    d = admin.get("/api/dashboard").json()
    students = admin.get("/api/students").json()
    check(d["cards"]["total_students"] == len(students), "dashboard student count matches STUDENT table")
    check(student.get("/api/dashboard/me").status_code == 200, "student dashboard")
    sid = students[0]["student_id"]
    det = admin.get(f"/api/students/{sid}").json()
    tp = admin.get(f"/api/students/{sid}/total-paid").json()
    ma = admin.get(f"/api/students/{sid}/meals-attended").json()
    check("total_paid" in det and tp["total_paid"] == det["total_paid"], f"TOTAL_PAID({sid}) = {tp['total_paid']}")
    check(ma["meals_attended"] == det["meals_attended"], f"MEALS_ATTENDED({sid}) = {ma['meals_attended']}")
    check(admin.get("/api/students/999999").status_code == 404, "unknown student -> 404")
    check(admin.get("/api/menus?meal_type=Breakfast").status_code == 200, "menu meal-type filter")
    check(admin.get("/api/menus?meal_type=Brunch").status_code == 422, "invalid meal type -> 422")

    if args.readonly:
        return finish()

    created: dict[str, int] = {}
    try:
        section("Students CRUD")
        stamp = str(int(time.time()))[-6:]
        r = admin.post("/api/students", json={"student_name": "Test Student", "room_no": "T-1",
                                              "phone": "9000000000", "gender": "Male",
                                              "hostel_name": "Test Hostel", "email": f"t{stamp}@test.edu",
                                              "status": "Active", "not_a_column": "ignored"})
        check(r.status_code == 201, "create student (unknown field ignored)", r.text)
        created["student"] = r.json()["student_id"]
        r = admin.post("/api/students", json={"student_name": "Bad", "email": "not-an-email"})
        check(r.status_code == 422, "invalid email -> 422")
        r = admin.post("/api/students", json={"student_id": created["student"], "student_name": "Dup Id"})
        check(r.status_code == 409, "duplicate STUDENT_ID -> 409 (ORA-00001)", r.text)
        r = admin.put(f"/api/students/{created['student']}", json={"room_no": "T-2", "status": "Inactive"})
        check(r.status_code == 200 and r.json()["room_no"] == "T-2", "update student")
        r = admin.get("/api/students?hostel=Test Hostel&status=Inactive")
        check(r.ok and len(r.json()) == 1, "filter students by hostel + status")
        r = admin.delete(f"/api/students/{sid}")
        check(r.status_code == 409, "delete student with payments -> 409 (ORA-02292)", r.text)

        section("Food items + menus + menu items")
        r = admin.post("/api/food-items", json={"food_name": "Test Pulao", "category": "Lunch", "calories": 250,
                                                "availability": "Available"})
        check(r.status_code == 201, "create food item", r.text)
        created["food"] = r.json()["food_id"]
        r = staff.put(f"/api/food-items/{created['food']}", json={"availability": "Unavailable"})
        check(r.ok and r.json()["availability"] == "Unavailable", "staff updates food item")
        r = admin.delete("/api/food-items/1")
        check(r.status_code == 409, "delete food used in a menu -> 409 (ORA-02292)", r.text)
        r = staff.post("/api/menus", json={"menu_date": "2030-01-15"})
        check(r.status_code == 201, "staff creates menu", r.text)
        created["menu"] = r.json()["menu_id"]
        r = staff.post("/api/menu-items", json={"menu_id": created["menu"], "food_id": created["food"],
                                                "meal_type": "Lunch", "quantity_planned": 40})
        check(r.status_code == 201 and r.json()["food_name"] == "Test Pulao", "add menu item", r.text)
        created["menu_item"] = r.json()["menu_item_id"]
        r = staff.post("/api/menu-items", json={"menu_id": 999999, "food_id": created["food"], "meal_type": "Lunch"})
        check(r.status_code == 400, "menu item with unknown menu -> 400")
        r = staff.put(f"/api/menu-items/{created['menu_item']}", json={"quantity_planned": 50})
        check(r.ok and r.json()["quantity_planned"] == 50, "update menu item quantity")
        r = admin.get(f"/api/menus?date_from=2030-01-01&date_to=2030-01-31")
        check(r.ok and any(m["menu_id"] == created["menu"] and len(m["items"]) == 1 for m in r.json()),
              "menu date filter returns new menu with its item")

        section("Attendance")
        r = staff.post("/api/attendance", json={"student_id": created["student"], "menu_id": created["menu"],
                                                "meal_type": "Lunch", "status": "Present"})
        check(r.status_code == 201, "record attendance", r.text)
        created["attendance"] = r.json()["attendance_id"]
        r = staff.post("/api/attendance", json={"student_id": created["student"], "menu_id": created["menu"],
                                                "meal_type": "Lunch", "status": "Present"})
        check(r.status_code == 409, "duplicate attendance -> 409")
        ma = admin.get(f"/api/students/{created['student']}/meals-attended").json()["meals_attended"]
        check(ma == 1, "MEALS_ATTENDED counts the new Present row", str(ma))
        r = staff.put(f"/api/attendance/{created['attendance']}", json={"status": "Absent"})
        check(r.ok and r.json()["status"] == "Absent", "update attendance")
        r = staff.get(f"/api/attendance?student_id={created['student']}&status=Absent&meal_type=Lunch")
        check(r.ok and len(r.json()) == 1, "attendance filters")

        section("Payments: ADD_MESS_PAYMENT + PAYMENT_STATUS_AUDIT_TRG + TOTAL_PAID")
        before = admin.get(f"/api/students/{created['student']}/total-paid").json()["total_paid"]
        r = admin.post("/api/payments", json={"student_id": created["student"], "payment_month": "november 2026",
                                              "amount": 3100})
        check(r.status_code == 201 and r.json()["payment_status"] == "Paid",
              "ADD_MESS_PAYMENT inserts a Paid payment", r.text)
        pid = r.json()["payment_id"]
        check(r.json()["total_paid"] == before + 3100, "TOTAL_PAID increased by 3100")
        r = admin.post("/api/payments", json={"student_id": created["student"], "payment_month": "November 2026",
                                              "amount": 3100})
        check(r.status_code == 409 and "month" in r.json()["detail"], "same month again -> 409 (UQ_STUDENT_MONTH)",
              r.text)
        r = admin.post("/api/payments", json={"student_id": created["student"], "payment_month": "Nov-26",
                                              "amount": 10})
        check(r.status_code == 422, "bad month format -> 422")
        r = admin.post("/api/payments", json={"student_id": created["student"], "payment_month": "December 2026",
                                              "amount": -5})
        check(r.status_code == 422, "negative amount -> 422")
        r = admin.post("/api/payments", json={"student_id": 999999, "payment_month": "December 2026",
                                              "amount": 5})
        check(r.status_code == 400, "payment for unknown student -> 400")
        audit_before = len(admin.get(f"/api/payments/audit?payment_id={pid}").json())
        r = admin.patch(f"/api/payments/{pid}/status", json={"payment_status": "Pending"})
        check(r.ok and r.json()["payment_status"] == "Pending", "status Paid -> Pending", r.text)
        audit = admin.get(f"/api/payments/audit?payment_id={pid}").json()
        check(len(audit) == audit_before + 1 and audit[0]["old_status"] == "Paid"
              and audit[0]["new_status"] == "Pending", "trigger wrote PAYMENT_AUDIT row (Paid -> Pending)")
        r = admin.patch(f"/api/payments/{pid}/status", json={"payment_status": "Paid"})
        check(r.ok and len(r.json()["audit"]) == audit_before + 2, "status Pending -> Paid adds a 2nd audit row")
        r = admin.patch(f"/api/payments/{pid}/status", json={"payment_status": "Unknown"})
        check(r.status_code == 422, "invalid status -> 422")
        delete_student_blocked = admin.delete(f"/api/students/{created['student']}")
        check(delete_student_blocked.status_code == 409, "student with payment cannot be deleted (409)")

        section("Complaints: RESOLVE_COMPLAINT")
        r = student.post("/api/complaints", json={"student_id": 999, "complaint_type": "Food Quality",
                                                  "description": "Test complaint from smoke test",
                                                  "severity": "High", "menu_id": created["menu"]})
        check(r.status_code == 201 and r.json()["student_id"] == my_id and r.json()["status"] == "Open",
              "student submits complaint (forced to own id, default Open)", r.text)
        created["complaint"] = r.json()["complaint_id"]
        check(student.post(f"/api/complaints/{created['complaint']}/resolve").status_code == 403,
              "student cannot resolve")
        r = admin.patch(f"/api/complaints/{created['complaint']}/status", json={"status": "In Progress"})
        check(r.ok and r.json()["status"] == "In Progress", "admin sets In Progress")
        r = admin.post(f"/api/complaints/{created['complaint']}/resolve")
        check(r.ok and r.json()["status"] == "Resolved", "RESOLVE_COMPLAINT sets Resolved", r.text)
        check(admin.post(f"/api/complaints/{created['complaint']}/resolve").status_code == 400, "resolve twice -> 400")
        check(admin.post("/api/complaints/999999/resolve").status_code == 404, "resolve unknown id -> 404")
        r = admin.get("/api/complaints?severity=High&status=Resolved")
        check(r.ok and any(c["complaint_id"] == created["complaint"] for c in r.json()), "complaint filters")
        r = student.post("/api/complaints", json={"complaint_type": "X", "description": "short"})
        check(r.status_code == 422, "too-short complaint type -> 422")

        section("Wastage: CHECK_FOOD_WASTAGE trigger")
        r = staff.post("/api/wastage", json={"menu_item_id": created["menu_item"], "quantity_wasted": 999,
                                             "reason": "trigger test"})
        check(r.status_code == 400 and r.json().get("detail") == "Wastage cannot exceed planned quantity."
              and r.json().get("oracle_code") == "ORA-20001", "999 rejected by trigger with ORA-20001", r.text)
        r = staff.post("/api/wastage", json={"menu_item_id": 1, "quantity_wasted": 999})
        check(r.status_code == 400 and r.json().get("oracle_code") == "ORA-20001", "999 on menu item 1 rejected")
        r = staff.post("/api/wastage", json={"menu_item_id": created["menu_item"], "quantity_wasted": 5,
                                             "wastage_date": "2030-01-15", "reason": "smoke test"})
        check(r.status_code == 201 and r.json()["quantity_wasted"] == 5, "valid wastage accepted", r.text)
        created["wastage"] = r.json()["wastage_id"]
        r = staff.put(f"/api/wastage/{created['wastage']}", json={"quantity_wasted": 500})
        check(r.status_code == 400 and r.json().get("oracle_code") == "ORA-20001", "trigger also blocks bad UPDATE")
        r = staff.put(f"/api/wastage/{created['wastage']}", json={"quantity_wasted": 7})
        check(r.ok and r.json()["quantity_wasted"] == 7, "valid wastage update")
        r = staff.post("/api/wastage", json={"menu_item_id": 999999, "quantity_wasted": 1})
        check(r.status_code == 400, "unknown menu item -> 400")
        r = staff.post("/api/wastage", json={"menu_item_id": created["menu_item"], "quantity_wasted": -1})
        check(r.status_code == 422, "negative wastage -> 422")
        r = admin.delete(f"/api/menu-items/{created['menu_item']}")
        check(r.status_code == 409, "menu item with wastage cannot be deleted (409)")
    finally:
        section("Clean-up of temporary rows")
        for key, path in [("wastage", "/api/wastage/{}"), ("complaint", "/api/complaints/{}"),
                          ("attendance", "/api/attendance/{}"), ("menu_item", "/api/menu-items/{}"),
                          ("menu", "/api/menus/{}"), ("food", "/api/food-items/{}")]:
            if key in created:
                r = admin.delete(path.format(created[key]))
                check(r.ok, f"delete test {key}", r.text)
        if "student" in created:
            print(f"  (test student {created['student']} is kept because it now has a payment - "
                  "the foreign key correctly blocks deleting it)")
    finish()


def finish():
    passed = sum(1 for ok, _ in RESULTS if ok)
    failed = [label for ok, label in RESULTS if not ok]
    print(f"\n{passed}/{len(RESULTS)} checks passed.")
    if failed:
        print("Failed:", *failed, sep="\n  - ")
        sys.exit(1)


if __name__ == "__main__":
    main()
