# Mess Management System

**BTech DBMS project.** A hostel mess management web app built on **your existing Oracle database**. The tables, procedures, functions, triggers and sequence are the ones from the project report. The app **reads and uses** them and never recreates or alters them.

| Layer | Technology |
|---|---|
| Database | Oracle (your schema: STUDENT, MENU, FOOD_ITEM, MENU_ITEM, ATTENDANCE, PAYMENT, COMPLAINT, WASTAGE, PAYMENT_AUDIT, PAYMENT_AUDIT_SEQ) |
| Backend | Python **FastAPI** + **python-oracledb** (thin mode, so no Oracle Client install is needed for Oracle 12.1+) |
| Auth | JWT tokens + bcrypt password hashes stored in one new table, `APP_USERS` |
| Frontend | **React + Vite**, plain CSS, recharts (charts), lucide-react (icons), react-router-dom |

---

## 1. Features

| Page | What it does | Oracle objects used |
|---|---|---|
| **Login** | Username/password login. Roles: admin, staff, student | `APP_USERS` |
| **Dashboard** | Live counts, attendance trend, payment-status donut, top wasted foods, complaints by severity, attendance by meal, recent payments and complaints | all tables |
| **Students** | Search, filter, add, edit and delete students. The details view shows `TOTAL_PAID()` and `MEALS_ATTENDED()` | `STUDENT`, both functions |
| **Menus** | Menus grouped by date, with Breakfast/Lunch/Snack/Dinner sections and a photo card for every dish. Clickable meal tabs with counts, an "Add food to …" button in each meal section (prefilled), and a food picker with thumbnails. Add, edit and delete menus and menu items (meal type, planned quantity) | `MENU`, `MENU_ITEM` |
| **Food Items** | Food catalogue as a photo grid (or a table), with clickable category tabs, search and an availability filter | `FOOD_ITEM` |
| **Attendance** | Mark Present/Absent per student per meal, plus a per-student summary | `ATTENDANCE`, `MEALS_ATTENDED()` |
| **Payments** | Add a payment through the **`ADD_MESS_PAYMENT`** procedure, change its status (fires **`PAYMENT_STATUS_AUDIT_TRG`**), view the audit trail and per-student totals (`TOTAL_PAID()`) | `PAYMENT`, `PAYMENT_AUDIT` |
| **Complaints** | Students raise complaints. Admin resolves them via the **`RESOLVE_COMPLAINT`** procedure or set them In Progress | `COMPLAINT` |
| **Food Wastage** | Record wastage. The **`CHECK_FOOD_WASTAGE`** trigger rejects wastage above the planned quantity (ORA-20001), and the error is shown in the form | `WASTAGE`, `MENU_ITEM` |
| **Reports** | 6 reports (student attendance, payment summary, pending payments, complaint status, food wastage, menu/food) with CSV export and printing | joins, GROUP BY, NOT EXISTS, functions |

### Food photos

The dish photos are in `frontend/public/food/`. They are real photos from Wikimedia Commons, and `frontend/public/food/CREDITS.md` lists the author and licence of each one. `frontend/src/utils/foodImages.js` matches a food name to a photo by keyword, ignoring case and small spelling differences (for example, "Masala Dosa" uses `dosa.webp` and "Veg Biriyani" uses `biryani.webp`). A food with no matching photo shows a coloured tile with an emoji. To add a photo, put a `.webp` file in that folder and add a rule to `RULES` in `foodImages.js`. The database is unchanged.

### Roles (enforced on the server, not just hidden buttons)

| Role | Can do |
|---|---|
| **admin** | Everything |
| **staff** | View students; manage menus, food items, attendance and wastage; view complaints; the wastage and menu reports. **No access to payments** (the API returns 403) |
| **student** | Their own dashboard, menu, attendance, payments and complaints only. The server always uses the logged-in student's ID, so they cannot see anyone else's data even by editing the URL or the API request |

Every API route checks the JWT and the role. The frontend only hides what the server would refuse anyway.

---

## 2. Architecture

```
 Browser (React, :5173)
     │  fetch /api/...   (JWT in Authorization header)
     ▼
 Vite dev proxy ──► FastAPI (:8000)
                      routers/       HTTP endpoints + role checks
                      services/      business rules
                      repositories/  SQL only (all parameterized :binds)
                      db.py          python-oracledb connection pool
                      │
                      ▼
                 Oracle Database (your schema)
                   tables · ADD_MESS_PAYMENT · RESOLVE_COMPLAINT
                   TOTAL_PAID · MEALS_ATTENDED
                   PAYMENT_STATUS_AUDIT_TRG · CHECK_FOOD_WASTAGE
```

* **SQL injection is prevented.** Every value goes in as a bind variable (`:student_id`). Column and table names come only from a fixed whitelist read from Oracle's data dictionary.
* **No passwords in code.** All credentials come from `backend\.env`, which is not included in the zip.
* **Schema-aware.** At startup the backend reads the real columns of STUDENT and MENU from `USER_TAB_COLUMNS`, so extra columns in your tables appear in the forms automatically.
* **Oracle errors become friendly messages.** For example, ORA-20001 from the trigger becomes a 400 with the trigger's message, ORA-00001 becomes "already exists", and ORA-02292 becomes "has related records".

---

## 3. Folder structure

```
mess-management-system/
├── .env.example                ← copy to backend\.env and fill in
├── README.md
├── docs/screenshots/          ← screenshots of every page (tested build)
├── database/
│   ├── 01_app_users.sql        ← run ONCE: creates the APP_USERS login table
│   ├── 02_verify_schema.sql    ← read-only checks (DESC tables, list objects)
│   └── test_schema_reproduction.sql  ← ⚠ TEST DB ONLY (drops & recreates tables)
├── backend/
│   ├── requirements.txt
│   ├── test_connection.py      ← checks .env + Oracle + your objects
│   ├── create_user.py          ← adds admin/staff/student logins (password typed hidden)
│   ├── tests/smoke_test.py     ← end-to-end API test (--readonly is safe)
│   └── app/
│       ├── main.py             ← FastAPI app, CORS, routers
│       ├── config.py           ← reads .env
│       ├── db.py               ← connection pool (thin / thick mode)
│       ├── schema_meta.py      ← reads your real columns & objects
│       ├── security.py         ← bcrypt, JWT, role checks
│       ├── errors.py           ← ORA-xxxxx → friendly HTTP errors
│       ├── schemas.py          ← request validation (Pydantic)
│       ├── repositories/       ← SQL for each table
│       ├── services/           ← business logic
│       └── routers/            ← API endpoints
└── frontend/
    ├── package.json, vite.config.js, index.html
    └── src/
        ├── api/client.js        ← fetch wrapper (token, errors)
        ├── context/             ← AuthContext, ToastContext
        ├── hooks/               ← useApi, useForm
        ├── components/          ← Layout, DataTable, Modal, Charts, Form, ui
        ├── pages/               ← Dashboard, Students, Menus, FoodItems, Attendance,
        │                          Payments, Complaints, Wastage, Reports, Login ...
        ├── utils/               ← format, validate
        └── styles/index.css
```

---

## 4. Setup on Windows (PowerShell)

### Prerequisites
* **Python 3.10+** (`python --version`). When installing, tick *"Add Python to PATH"*.
* **Node.js 18+** (`node --version`), from https://nodejs.org (LTS).
* Your Oracle database running, plus your Oracle username, password and service name (for example `XEPDB1`).

### Step 1: Extract
Extract the zip to, for example, `C:\Projects\mess-management-system`.

### Step 2: Backend virtual environment
```powershell
cd C:\Projects\mess-management-system\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```
> If PowerShell says *"running scripts is disabled"*, run this once:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` and then activate again.

### Step 3: Create your local .env (your password stays on your laptop)
```powershell
copy ..\.env.example .env
notepad .env
```
Fill in `DB_USER`, `DB_PASSWORD` and `DB_DSN`, and set `JWT_SECRET` to a random string:
```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```
Never share or commit this file.

### Step 4: Create the login table (one new table, nothing else changes)
Open SQL*Plus **as your project user** (the owner of STUDENT, PAYMENT and the other tables):
```powershell
sqlplus your_user@localhost:1521/XEPDB1
```
```sql
SQL> @C:\Projects\mess-management-system\database\01_app_users.sql
SQL> @C:\Projects\mess-management-system\database\02_verify_schema.sql   -- optional check
SQL> exit
```
**Why this table?** Real role-based login needs somewhere to store usernames, password hashes and roles, and your schema has no such table. `APP_USERS` is the **only** new object. It has a foreign key to `STUDENT(STUDENT_ID)` so that each student login maps to exactly one student. To remove it: `DROP TABLE APP_USERS PURGE;`

### Step 5: Test the connection
```powershell
python test_connection.py
```
It prints your Oracle version, the columns it found, and which procedures, functions and triggers exist (with VALID or INVALID status).

### Step 6: Create logins (passwords are typed hidden and stored as bcrypt hashes)
```powershell
python create_user.py --username admin --role admin
python create_user.py --username staff --role staff
python create_user.py --username aarav --role student --student-id 101
python create_user.py --list
python create_user.py --username admin --reset-password
```
The student ID must already exist in your STUDENT table.

### Step 7: Start the backend
```powershell
uvicorn app.main:app --reload --port 8000
```
Open http://localhost:8000/docs for the interactive API (Swagger). Use **Authorize** there to log in. Health check: http://localhost:8000/api/health

### Step 8: Start the frontend (in a **second** PowerShell window)
```powershell
cd C:\Projects\mess-management-system\frontend
npm install
npm run dev
```
Open **http://localhost:5173** and log in with the admin you created.

Production build (optional): `npm run build`, then `npm run preview`, which serves on http://localhost:4173.

### Every time after the first setup
```powershell
# window 1
cd C:\Projects\mess-management-system\backend; .\venv\Scripts\Activate.ps1; uvicorn app.main:app --reload --port 8000
# window 2
cd C:\Projects\mess-management-system\frontend; npm run dev
```

### Older Oracle (11g / 12.1): thick mode
python-oracledb **thin mode needs Oracle Database 12.1 or newer**. On older versions you will see `DPY-3010: connections to this database server version are not supported`. To fix it:
1. Download **Oracle Instant Client Basic** (64-bit, matching your Python) and unzip it, for example to `C:\oracle\instantclient_21_13`.
2. In `backend\.env`, set:
   ```
   ORACLE_THICK_MODE=true
   ORACLE_CLIENT_LIB_DIR=C:\oracle\instantclient_21_13
   ```
3. Restart uvicorn. `python test_connection.py` will report "thick mode".

You may also need the *Visual C++ Redistributable* that Instant Client lists.

---

## 5. API endpoints

All endpoints except `/api/health` and `/api/auth/login` need `Authorization: Bearer <token>`. Full interactive docs are at **/docs**.

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | /api/health | public | API up? Oracle reachable? |
| POST | /api/auth/login | public | `{username, password}` returns a JWT |
| POST | /api/auth/token | public | OAuth2 form login (Swagger "Authorize") |
| GET | /api/auth/me | all | Current user |
| POST | /api/auth/change-password | all | Change your own password |
| GET | /api/meta/columns/{table} | all | Real columns of STUDENT / MENU |
| GET | /api/meta/schema-check | admin | Which objects were found |
| GET | /api/dashboard | admin, staff | Dashboard data (payment figures removed server-side for staff) |
| GET | /api/dashboard/me | student | Student's own dashboard |
| GET / POST | /api/students | admin, staff / admin | List (search/filter) / add |
| GET | /api/students/me | student | Own record |
| GET / PUT / DELETE | /api/students/{id} | admin, staff, own student / admin | Details incl. TOTAL_PAID and MEALS_ATTENDED / update / delete |
| GET | /api/students/{id}/total-paid | admin, staff, own student | Calls `TOTAL_PAID` |
| GET | /api/students/{id}/meals-attended | admin, staff, own student | Calls `MEALS_ATTENDED` |
| GET / POST | /api/menus | all / admin, staff | Menus with items / add |
| GET / PUT / DELETE | /api/menus/{id} | all / admin, staff | One menu / update / delete |
| GET / POST | /api/menu-items | all / admin, staff | Menu items / add |
| PUT / DELETE | /api/menu-items/{id} | admin, staff | Update / delete |
| GET / POST | /api/food-items | all / admin, staff | Food items / add |
| GET / PUT / DELETE | /api/food-items/{id} | all / admin, staff | One / update / delete |
| GET / POST | /api/attendance | all (students: own) / admin, staff | Records / mark |
| GET | /api/attendance/summary | all (students: own) | Summary using `MEALS_ATTENDED` |
| PUT / DELETE | /api/attendance/{id} | admin, staff | Update / delete |
| GET | /api/payments | admin, student (own) | Payments |
| POST | /api/payments | admin | **Calls `ADD_MESS_PAYMENT`** |
| GET | /api/payments/summary | admin | Totals by status and month |
| GET | /api/payments/audit | admin | `PAYMENT_AUDIT` rows |
| GET | /api/payments/{id} | admin, own student | One payment |
| PATCH | /api/payments/{id}/status | admin | UPDATE status, which **fires `PAYMENT_STATUS_AUDIT_TRG`** |
| GET / POST | /api/complaints | all (students: own) | List / submit |
| GET | /api/complaints/summary | all (students: own) | Counts |
| GET / DELETE | /api/complaints/{id} | all (own) / admin | One / delete |
| POST | /api/complaints/{id}/resolve | admin | **Calls `RESOLVE_COMPLAINT`** |
| PATCH | /api/complaints/{id}/status | admin | Open / In Progress |
| GET / POST | /api/wastage | admin, staff | List / add (**`CHECK_FOOD_WASTAGE`** validates) |
| GET | /api/wastage/summary | admin, staff | Totals |
| PUT / DELETE | /api/wastage/{id} | admin, staff | Update (trigger validates again) / delete |
| GET | /api/reports/student-attendance | admin | Uses `MEALS_ATTENDED` |
| GET | /api/reports/payment-summary | admin | Uses `TOTAL_PAID` |
| GET | /api/reports/pending-payments | admin | Pending/failed + students with no payment (NOT EXISTS) |
| GET | /api/reports/complaint-status | admin | Complaint counts + unresolved list |
| GET | /api/reports/food-wastage | admin, staff | Wastage vs planned |
| GET | /api/reports/menu-food | admin, staff | Menu-wise food |

Error format: `{"detail": "...", "oracle_code": "ORA-20001", "errors": {...}}`. The codes used are 400 (rule/trigger), 401, 403, 404, 409 (duplicate / has related records), 422 (validation) and 503 (database offline).

---

## 6. Demonstrating the PL/SQL objects

### Procedure `ADD_MESS_PAYMENT`
* **UI:** Payments → **Add payment**. Choose a student, a month and an amount, then save. The backend runs `cursor.callproc("ADD_MESS_PAYMENT", [id, student, 'November 2026', amount])` and the new row appears with status *Paid*.
* Try adding the **same student and month again**. The `UQ_STUDENT_MONTH` constraint inside the procedure's INSERT raises ORA-00001, and the app shows "already has a payment for this month".
* **SQL*Plus:**
  ```sql
  SET SERVEROUTPUT ON
  EXEC ADD_MESS_PAYMENT(99, 101, 'December 2026', 3200);
  SELECT * FROM PAYMENT WHERE PAYMENT_ID = 99;
  ```

### Procedure `RESOLVE_COMPLAINT`
* **UI:** Complaints → click **Resolve** on an open complaint. The status changes to *Resolved*.
* **SQL*Plus:** `EXEC RESOLVE_COMPLAINT(1);` then `SELECT STATUS FROM COMPLAINT WHERE COMPLAINT_ID = 1;`

### Function `TOTAL_PAID`
* **UI:** Students → click a student. The details show **Total paid (TOTAL_PAID)**. Also see Payments → *Student totals* and Reports → *Payment summary*.
* Change one of that student's payments from Paid to Pending and the total drops immediately.
* **SQL:** `SELECT STUDENT_ID, TOTAL_PAID(STUDENT_ID) FROM STUDENT;`

### Function `MEALS_ATTENDED`
* **UI:** Students → details → **Meals attended**, Attendance → *Summary* tab, or Reports → *Student attendance*.
* Mark the student *Present* for another meal and the count goes up.
* **SQL:** `SELECT STUDENT_ID, MEALS_ATTENDED(STUDENT_ID) FROM STUDENT;`

### Trigger `PAYMENT_STATUS_AUDIT_TRG`
* **UI:** Payments → click the status of a payment → change it (for example Paid → Pending) → save. The modal shows the new audit row. Payments → **Audit trail** tab lists all `PAYMENT_AUDIT` rows (old status → new status, time).
* The app only runs `UPDATE PAYMENT SET PAYMENT_STATUS = :s`. The audit row is written **by the trigger**, not by Python.
* **SQL:**
  ```sql
  UPDATE PAYMENT SET PAYMENT_STATUS = 'Pending' WHERE PAYMENT_ID = 1;
  COMMIT;
  SELECT * FROM PAYMENT_AUDIT ORDER BY AUDIT_ID DESC;
  ```

### Trigger `CHECK_FOOD_WASTAGE`
* **UI:** Food Wastage → **Add wastage**. Pick a menu item (the form shows its *planned quantity*) and enter **more** than planned. Oracle rejects it and the form shows *"Oracle rejected this (ORA-20001): Wastage cannot exceed planned quantity."* A value within the limit saves normally.
* The frontend deliberately does **not** pre-check the amount, so that you can show the database enforcing the rule.
* **SQL:**
  ```sql
  INSERT INTO WASTAGE (WASTAGE_ID, MENU_ITEM_ID, QUANTITY_WASTED, WASTAGE_DATE)
  VALUES (999, 1, 100000, SYSDATE);   -- ORA-20001
  ```
  (Adjust the column list to match your WASTAGE table.)

### Constraints worth showing
* Duplicate payment month, which hits `UQ_STUDENT_MONTH` (ORA-00001).
* Deleting a student who has payments, which fails with ORA-02292 (child record found). The app explains that the student has related records.
* Invalid status values are blocked by the CHECK constraints (ORA-02290) and by form validation.

---

## 7. Troubleshooting

| Error | Meaning | Fix |
|---|---|---|
| `DPY-4011` / `ORA-12541: no listener` | Oracle or its listener isn't running | Start the Oracle services (Windows **Services** → `OracleServiceXE` and `OracleOraDB21Home1TNSListener`), or run `lsnrctl start` |
| `ORA-12514` / `DPY-6001` service not known | Wrong service name in `DB_DSN` | Run `lsnrctl status` and use the listed service (often `XEPDB1`, not `XE`) |
| `ORA-01017` invalid username/password | Wrong `DB_USER` / `DB_PASSWORD` | Fix `backend\.env`. Test with `sqlplus user@dsn` |
| `ORA-28000` account locked | Too many bad logins | As SYSTEM: `ALTER USER your_user ACCOUNT UNLOCK;` |
| `ORA-28001` password expired | Expired | `ALTER USER your_user IDENTIFIED BY newpass;` then update `.env` |
| `ORA-00942` table or view does not exist | Wrong schema user, or APP_USERS not created | Connect as the owner of the tables. Run `01_app_users.sql` |
| `ORA-04098` trigger is invalid | A trigger failed to compile | `SELECT * FROM USER_ERRORS;` and recompile it in SQL*Plus |
| `ORA-06550` / `PLS-00201` | Procedure/function missing or invalid | `python test_connection.py` lists their status |
| `ORA-20001` | `CHECK_FOOD_WASTAGE` rule, as intended | Enter a quantity ≤ planned |
| `ORA-00001` unique constraint | Duplicate (for example the same student and month) | Expected. Choose another month |
| `ORA-02292` child record found | Deleting a row others depend on | Delete the child rows first, or keep it |
| `DPY-3010` version not supported | Oracle older than 12.1 | Use thick mode (section 4) |
| `DPY-3015` password verifier not supported | Old 10G password verifier | Reset the password (`ALTER USER ... IDENTIFIED BY ...`) or use thick mode |
| `DPY-1001` not connected | Database restarted | Restart uvicorn |
| Login says "Invalid username or password" | No user created yet | `python create_user.py --list` |
| Frontend: "Cannot reach the server" | Backend not running | Start uvicorn on port 8000 |
| CORS error | Frontend opened on a different port | Add that origin to `CORS_ORIGINS` in `.env` |
| `Activate.ps1 cannot be loaded` | Execution policy | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `'npm' is not recognized` | Node not installed or not on PATH | Install Node LTS and reopen PowerShell |

Testing the API: with the backend running, `python tests\smoke_test.py --readonly` is **safe** on your real data because it only reads. Set `ADMIN_PASS`, `STAFF_PASS` and `STUDENT_PASS` as environment variables first, for example `$env:ADMIN_PASS="..."`. The full test (without `--readonly`) also writes data, so run it only on a test database.

---

## 8. Viva demo checklist

1. ☐ `python test_connection.py` shows the Oracle version, all 9 tables, 2 procedures, 2 functions, 2 triggers (VALID) and the sequence.
2. ☐ Log in as **admin** and walk through the Dashboard (live data from Oracle).
3. ☐ **Students:** search, add a student (show the validation), and open details to show **TOTAL_PAID** and **MEALS_ATTENDED**.
4. ☐ **Menus / Food Items:** add a food item and add it to a menu with a planned quantity.
5. ☐ **Attendance:** mark Present, then show that MEALS_ATTENDED increased.
6. ☐ **Payments:** Add payment, which uses **ADD_MESS_PAYMENT**. Then add the same month again to show the UNIQUE constraint error.
7. ☐ **Payments:** change status Paid → Pending, open the **Audit trail** to show **PAYMENT_STATUS_AUDIT_TRG** worked, and show that TOTAL_PAID dropped.
8. ☐ **Complaints (as admin):** Resolve, which uses **RESOLVE_COMPLAINT**.
9. ☐ **Wastage:** enter more than planned to show **ORA-20001** from **CHECK_FOOD_WASTAGE**, then enter a valid amount, which saves.
10. ☐ **Reports:** show the 6 reports (joins, GROUP BY, NOT EXISTS, functions), CSV export and Print.
11. ☐ Log in as **staff**: Payments is not available (the API returns 403, not just a hidden button).
12. ☐ Log in as a **student**: they see only their own payments, attendance and complaints, and can raise a complaint.
13. ☐ Open http://localhost:8000/docs to show the REST API and the parameterized SQL in `backend/app/repositories/`.
14. ☐ Explain the security: `.env` for secrets, bcrypt hashes, JWT, bind variables, and server-side role checks.

---

## 9. Assumptions about your schema

The project report did not list every column of **STUDENT** and **MENU**, so the test database used these columns:

* **STUDENT:** `STUDENT_ID NUMBER` (PK), `STUDENT_NAME VARCHAR2(50) NOT NULL`, `ROOM_NO VARCHAR2(10)`, `PHONE VARCHAR2(15)`, plus the assumed columns `GENDER VARCHAR2(10)`, `HOSTEL_NAME VARCHAR2(50)`, `EMAIL VARCHAR2(100)` and `STATUS VARCHAR2(15) DEFAULT 'Active'`.
* **MENU:** only `MENU_ID` (PK) and `MENU_DATE`. The meal type is on MENU_ITEM.

**You do not need to match these.** The backend reads your real columns at startup (`/api/meta/columns/STUDENT`), shows only the columns that exist, and adds any extra ones to the forms automatically. If a column the app uses is missing, that field is simply not shown.

The status values used are the ones from the report's CHECK constraints: Active/Inactive, Present/Absent, Paid/Pending/Failed, Open/In Progress/Resolved, Low/Medium/High, Breakfast/Lunch/Snack/Dinner, and Available/Unavailable. The payment month is stored as text such as `November 2026`. Foreign key constraint names (FK_MI_MENU and so on) were also assumed; the app does not depend on them.

`database/test_schema_reproduction.sql` recreates the schema **for testing only**. **Never run it on your real database**, because it drops the tables.
