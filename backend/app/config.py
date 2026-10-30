"""Application settings, read from the .env file (never hard-coded)."""
import os
import secrets
import logging
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BACKEND_DIR.parent

# backend/.env is preferred; the project-root .env is used as a fallback.
load_dotenv(BACKEND_DIR / ".env")
load_dotenv(PROJECT_DIR / ".env")

log = logging.getLogger("mess")


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


class Settings:
    def __init__(self) -> None:
        self.db_user = os.getenv("DB_USER", "")
        self.db_password = os.getenv("DB_PASSWORD", "")
        self.db_dsn = os.getenv("DB_DSN", "localhost:1521/XEPDB1")
        self.db_pool_min = _int("DB_POOL_MIN", 1)
        self.db_pool_max = _int("DB_POOL_MAX", 5)

        # Thick mode is only needed for Oracle Database 11g / 12.1 and older.
        self.oracle_thick_mode = os.getenv("ORACLE_THICK_MODE", "false").lower() in ("1", "true", "yes")
        self.oracle_client_lib_dir = os.getenv("ORACLE_CLIENT_LIB_DIR") or None

        secret = os.getenv("JWT_SECRET", "")
        if not secret or secret.startswith("change-me"):
            log.warning("JWT_SECRET is not set in .env - using a temporary random secret. "
                        "Everyone will be logged out when the server restarts.")
            secret = secrets.token_urlsafe(48)
        self.jwt_secret = secret
        self.jwt_algorithm = "HS256"
        self.jwt_expire_minutes = _int("JWT_EXPIRE_MINUTES", 480)

        origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
        self.cors_origins = [o.strip() for o in origins.split(",") if o.strip()]

    def missing_db_settings(self) -> list[str]:
        return [n for n, v in (("DB_USER", self.db_user), ("DB_PASSWORD", self.db_password),
                               ("DB_DSN", self.db_dsn)) if not v]


settings = Settings()
