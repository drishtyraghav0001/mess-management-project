-- =====================================================================
--  Read-only checks. Safe to run on your real database at any time.
--      SQL> @C:\Projects\mess-management-system\database\02_verify_schema.sql
-- =====================================================================
SET LINESIZE 200 PAGESIZE 100 LONG 4000
COLUMN SEARCH_CONDITION FORMAT A60
COLUMN OBJECT_NAME FORMAT A30

DESC STUDENT;
DESC MENU;
DESC FOOD_ITEM;
DESC MENU_ITEM;
DESC ATTENDANCE;
DESC PAYMENT;
DESC COMPLAINT;
DESC WASTAGE;
DESC PAYMENT_AUDIT;

SELECT object_name, object_type, status
FROM   user_objects
WHERE  object_type IN ('PROCEDURE','FUNCTION','TRIGGER','SEQUENCE')
ORDER  BY object_type, object_name;

SELECT table_name, constraint_name, constraint_type, search_condition
FROM   user_constraints
WHERE  table_name IN ('STUDENT','MENU','FOOD_ITEM','MENU_ITEM','ATTENDANCE',
                      'PAYMENT','COMPLAINT','WASTAGE','PAYMENT_AUDIT','APP_USERS')
ORDER  BY table_name, constraint_type;

SELECT banner FROM v$version;
