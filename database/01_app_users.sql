-- =====================================================================
--  Mess Management System - login table for the web application
-- =====================================================================
--  Run this ONCE in SQL*Plus, connected as the same user that owns
--  STUDENT, MENU, PAYMENT ... (your project schema).
--
--      SQL> @C:\Projects\mess-management-system\database\01_app_users.sql
--
--  What it does:
--    * Creates ONE new table, APP_USERS, that stores web logins.
--    * Passwords are stored as bcrypt hashes (never plain text).
--    * A "student" login is linked to a row in your STUDENT table
--      through a foreign key, so a student can only see their own
--      attendance, payments and complaints.
--
--  What it does NOT do:
--    * It does not change, drop or recreate any existing table,
--      procedure, function, trigger or sequence.
--
--  Users are added with:  python create_user.py   (see README)
-- =====================================================================

CREATE TABLE APP_USERS (
  USER_ID       NUMBER        CONSTRAINT PK_APP_USERS PRIMARY KEY,
  USERNAME      VARCHAR2(50)  NOT NULL,
  PASSWORD_HASH VARCHAR2(100) NOT NULL,
  ROLE          VARCHAR2(10)  NOT NULL,
  STUDENT_ID    NUMBER,
  IS_ACTIVE     CHAR(1)       DEFAULT 'Y' NOT NULL,
  CREATED_AT    DATE          DEFAULT SYSDATE,
  CONSTRAINT UQ_APP_USERS_USERNAME UNIQUE (USERNAME),
  CONSTRAINT CK_APP_USERS_ROLE     CHECK (ROLE IN ('admin','staff','student')),
  CONSTRAINT CK_APP_USERS_ACTIVE   CHECK (IS_ACTIVE IN ('Y','N')),
  CONSTRAINT CK_APP_USERS_STUDENT  CHECK (
      (ROLE = 'student' AND STUDENT_ID IS NOT NULL) OR
      (ROLE <> 'student' AND STUDENT_ID IS NULL)),
  CONSTRAINT FK_APP_USERS_STUDENT  FOREIGN KEY (STUDENT_ID)
      REFERENCES STUDENT(STUDENT_ID)
);

DESC APP_USERS;

-- To undo (removes ONLY the login table):
--   DROP TABLE APP_USERS PURGE;
