"""SQLite-backed local accounts with optional PostgreSQL for hosted persistence."""
from __future__ import annotations

import hashlib
import json
import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

from config import ROOT

DB_PATH = Path(os.environ.get("APP_DB_PATH", str(ROOT / ".data" / "vuonhoa.sqlite3")))
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
SESSION_DAYS = 14


def _connect() -> sqlite3.Connection:
    if DATABASE_URL:
        try:
            import psycopg
            from psycopg.rows import dict_row
        except ImportError as exc:
            raise RuntimeError("DATABASE_URL cần psycopg được cài đặt.") from exc
        return _PostgresConnection(psycopg.connect(DATABASE_URL, row_factory=dict_row, connect_timeout=10))
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    db.execute("PRAGMA journal_mode=WAL")
    return db


class _PostgresConnection:
    """Small adapter so the account store keeps one portable SQL implementation."""

    def __init__(self, connection):
        self.connection = connection

    def __enter__(self):
        self.connection.__enter__()
        return self

    def __exit__(self, exc_type, exc, tb):
        return self.connection.__exit__(exc_type, exc, tb)

    def execute(self, sql: str, parameters=()):
        sql = sql.replace("?", "%s")
        return self.connection.execute(sql, parameters)


def initialize() -> None:
    with _connect() as db:
        if DATABASE_URL:
            schema = (
                "CREATE TABLE IF NOT EXISTS users (id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE, "
                "display_name TEXT NOT NULL, password_hash BYTEA NOT NULL, password_salt BYTEA NOT NULL, created_at TEXT NOT NULL)",
                "CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL)",
                "CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at)",
                "CREATE TABLE IF NOT EXISTS user_data (user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, data_key TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, data_key))",
            )
            for statement in schema:
                db.execute(statement)
        else:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY,
                    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                    display_name TEXT NOT NULL,
                    password_hash BLOB NOT NULL,
                    password_salt BLOB NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS sessions (
                    token_hash TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    expires_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
                CREATE TABLE IF NOT EXISTS user_data (
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    data_key TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (user_id, data_key)
                );
            """)


def _password(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1, dklen=32)


def create_user(email: str, display_name: str, password: str) -> tuple[dict, str]:
    email = email.strip().lower()
    salt = secrets.token_bytes(16)
    created = datetime.now(timezone.utc).isoformat()
    with _connect() as db:
        try:
            cur = db.execute(
                "INSERT INTO users(email, display_name, password_hash, password_salt, created_at) VALUES(?,?,?,?,?) RETURNING id",
                (email, display_name.strip(), _password(password, salt), salt, created),
            )
        except sqlite3.IntegrityError as exc:
            raise ValueError("Email này đã có tài khoản.") from exc
        except Exception as exc:
            if getattr(exc, "sqlstate", None) != "23505":
                raise
            raise ValueError("Email này đã có tài khoản.") from exc
        user_id = cur.fetchone()["id"]
        user = {"id": user_id, "email": email, "display_name": display_name.strip(), "created_at": created}
        token = _new_session(db, user_id)
    return user, token


def login(email: str, password: str) -> tuple[dict, str] | None:
    with _connect() as db:
        # Emails are normalized at registration, but compare case-insensitively
        # for existing rows on both SQLite and PostgreSQL.
        row = db.execute("SELECT * FROM users WHERE LOWER(email)=LOWER(?)", (email.strip(),)).fetchone()
        # Equalize the missing-user path so it does not immediately reveal account existence.
        salt = row["password_salt"] if row else bytes(16)
        actual = _password(password, salt)
        if not row or not secrets.compare_digest(actual, row["password_hash"]):
            return None
        user = {"id": row["id"], "email": row["email"], "display_name": row["display_name"], "created_at": row["created_at"]}
        token = _new_session(db, row["id"])
        return user, token


def _new_session(db: sqlite3.Connection, user_id: int) -> str:
    now = datetime.now(timezone.utc)
    db.execute("DELETE FROM sessions WHERE expires_at <= ?", (now.isoformat(),))
    token = secrets.token_urlsafe(32)
    db.execute("INSERT INTO sessions(token_hash, user_id, expires_at) VALUES(?,?,?)", (
        hashlib.sha256(token.encode()).hexdigest(), user_id, (now + timedelta(days=SESSION_DAYS)).isoformat(),
    ))
    return token


def get_user(token: str | None) -> dict | None:
    if not token:
        return None
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    with _connect() as db:
        row = db.execute("""SELECT u.id, u.email, u.display_name, u.created_at
            FROM sessions s JOIN users u ON u.id=s.user_id
            WHERE s.token_hash=? AND s.expires_at>?""", (token_hash, datetime.now(timezone.utc).isoformat())).fetchone()
    return dict(row) if row else None


def delete_session(token: str | None) -> None:
    if token:
        with _connect() as db:
            db.execute("DELETE FROM sessions WHERE token_hash=?", (hashlib.sha256(token.encode()).hexdigest(),))


def read_user_data(user_id: int, key: str) -> dict | None:
    with _connect() as db:
        row = db.execute("SELECT payload FROM user_data WHERE user_id=? AND data_key=?", (user_id, key)).fetchone()
    return json.loads(row["payload"]) if row else None


def write_user_data(user_id: int, key: str, payload: dict) -> None:
    encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    with _connect() as db:
        db.execute("""INSERT INTO user_data(user_id,data_key,payload,updated_at) VALUES(?,?,?,?)
            ON CONFLICT(user_id,data_key) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at""",
            (user_id, key, encoded, datetime.now(timezone.utc).isoformat()))
