"""Password hashing (bcrypt), JWT tokens and role checks.

Every protected endpoint declares which roles may call it, e.g.
    user = Depends(require_roles("admin", "staff"))
so the rules are enforced by the backend, not just hidden in the UI.
"""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
import oracledb
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer

from .config import settings
from .db import fetch_one, get_conn
from .errors import ApiError
from .schema_meta import meta

ROLES = ("admin", "staff", "student")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)


def hash_password(password: str) -> str:
    if len(password.encode("utf-8")) > 72:
        raise ValueError("Password must be at most 72 bytes.")
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], password_hash.encode("ascii"))
    except ValueError:
        return False


def create_token(user: dict) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user["user_id"]),
        "username": user["username"],
        "role": user["role"],
        "student_id": user.get("student_id"),
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def load_user(conn: oracledb.Connection, user_id: int) -> dict | None:
    meta.require_table("APP_USERS")
    has_name = meta.has_column("STUDENT", "STUDENT_NAME")
    return fetch_one(conn.cursor(), f"""
        SELECT u.user_id, u.username, u.role, u.student_id, u.is_active
               {", s.student_name" if has_name else ", NULL AS student_name"}
        FROM app_users u LEFT JOIN student s ON s.student_id = u.student_id
        WHERE u.user_id = :id""", {"id": user_id})


def get_current_user(token: str | None = Depends(oauth2_scheme),
                     conn: oracledb.Connection = Depends(get_conn)) -> dict:
    if not token:
        raise ApiError(401, "Not logged in.")
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = int(payload["sub"])
    except jwt.ExpiredSignatureError:
        raise ApiError(401, "Your session has expired. Please log in again.")
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise ApiError(401, "Invalid login token. Please log in again.")
    # Re-read the user on every request so a disabled account or role change applies immediately.
    user = load_user(conn, user_id)
    if not user or user["is_active"] != "Y":
        raise ApiError(401, "This account no longer exists or has been disabled.")
    return user


def require_roles(*roles: str):
    for r in roles:
        assert r in ROLES, r

    def checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise ApiError(403, f"Your role ({user['role']}) is not allowed to do this. "
                                f"Allowed: {', '.join(roles)}.")
        return user
    return checker


ANY_USER = require_roles("admin", "staff", "student")
ADMIN = require_roles("admin")
ADMIN_STAFF = require_roles("admin", "staff")


def own_student_id(user: dict) -> int | None:
    """For students, the only student_id they may see. None for admin/staff."""
    if user["role"] == "student":
        if user.get("student_id") is None:
            raise ApiError(403, "This student login is not linked to a STUDENT record.")
        return int(user["student_id"])
    return None
