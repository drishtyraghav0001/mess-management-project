import oracledb
from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm

from ..db import fetch_one, get_conn
from ..errors import ApiError
from ..schema_meta import meta
from ..schemas import ChangePasswordIn, LoginIn
from ..security import ANY_USER, create_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def _login(conn: oracledb.Connection, username: str, password: str) -> dict:
    meta.require_table("APP_USERS")
    cur = conn.cursor()
    row = fetch_one(cur, """SELECT user_id, username, password_hash, role, student_id, is_active
                            FROM app_users WHERE LOWER(username) = LOWER(:u)""", {"u": username.strip()})
    if not row or not verify_password(password, row["password_hash"]):
        raise ApiError(401, "Incorrect username or password.")
    if row["is_active"] != "Y":
        raise ApiError(403, "This account is disabled.")
    user = {k: row[k] for k in ("user_id", "username", "role", "student_id")}
    return {"access_token": create_token(user), "token_type": "bearer", "user": user}


@router.post("/login", summary="Log in with JSON {username, password}")
def login(body: LoginIn, conn: oracledb.Connection = Depends(get_conn)):
    return _login(conn, body.username, body.password)


@router.post("/token", summary="OAuth2 form login (used by the Swagger 'Authorize' button)")
def token(form: OAuth2PasswordRequestForm = Depends(), conn: oracledb.Connection = Depends(get_conn)):
    return _login(conn, form.username, form.password)


@router.get("/me", summary="The logged-in user")
def me(user: dict = Depends(ANY_USER)):
    return user


@router.post("/change-password", summary="Change your own password")
def change_password(body: ChangePasswordIn, user: dict = Depends(ANY_USER),
                    conn: oracledb.Connection = Depends(get_conn)):
    cur = conn.cursor()
    row = fetch_one(cur, "SELECT password_hash FROM app_users WHERE user_id = :id", {"id": user["user_id"]})
    if not row or not verify_password(body.current_password, row["password_hash"]):
        raise ApiError(400, "Current password is incorrect.")
    cur.execute("UPDATE app_users SET password_hash = :h WHERE user_id = :id",
                {"h": hash_password(body.new_password), "id": user["user_id"]})
    conn.commit()
    return {"message": "Password changed."}
