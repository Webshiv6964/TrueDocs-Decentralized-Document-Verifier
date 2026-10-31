"""
db.py
SQLite database via aiosqlite — zero-config, no server required.

The database file lives at backend/truedocs.db (or DB_PATH in .env).
All tables are created on first startup.

A thin compatibility shim (execute / fetchrow / fetch) is provided so
the rest of the codebase keeps the same asyncpg-style call patterns.
"""

import os
import aiosqlite
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ── Config ─────────────────────────────────────────────────────────────────────
_here   = Path(__file__).parent.parent           # backend/
_env_db = os.getenv("DB_PATH", "")
DB_PATH = _env_db if _env_db else str(_here / "truedocs.db")

# Module-level connection — None until init_db()
_db: aiosqlite.Connection | None = None


# ── Schema ─────────────────────────────────────────────────────────────────────
_SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS documents (
    document_id       TEXT PRIMARY KEY,
    cid               TEXT NOT NULL,
    issuer            TEXT NOT NULL,
    timestamp         INTEGER NOT NULL,
    valid             INTEGER NOT NULL DEFAULT 1,
    tx_hash           TEXT,
    ipfs_url          TEXT,
    filename          TEXT,
    org_id            INTEGER REFERENCES organizations(id),
    doc_hash          TEXT,
    original_filename TEXT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(doc_hash);

CREATE TABLE IF NOT EXISTS organizations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    org_name        TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    contact_person  TEXT NOT NULL,
    purpose         TEXT NOT NULL,
    password_hash   TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'PENDING',
    email_verified  INTEGER NOT NULL DEFAULT 0,
    wallet_address  TEXT,
    wallet_nonce    INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    approved_at     TEXT,
    rejected_at     TEXT
);

CREATE TABLE IF NOT EXISTS admin (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


# ── Lifecycle ──────────────────────────────────────────────────────────────────

async def init_db() -> None:
    global _db
    try:
        _db = await aiosqlite.connect(DB_PATH, check_same_thread=False)
        _db.row_factory = aiosqlite.Row
        await _db.executescript(_SCHEMA)
        await _db.commit()

        # ── Migrations: add wallet columns if missing (existing DBs) ────────
        async with _db.execute("PRAGMA table_info(organizations)") as cur:
            cols = {row[1] for row in await cur.fetchall()}
        if "wallet_address" not in cols:
            await _db.execute("ALTER TABLE organizations ADD COLUMN wallet_address TEXT")
        if "wallet_nonce" not in cols:
            await _db.execute("ALTER TABLE organizations ADD COLUMN wallet_nonce INTEGER NOT NULL DEFAULT 0")
        await _db.commit()

        print(f"[INFO] SQLite database ready at {DB_PATH}")
    except Exception as e:
        print(f"[ERROR] Could not open SQLite database: {e}")
        _db = None


async def close_db() -> None:
    global _db
    if _db:
        await _db.close()
        _db = None


async def get_pool():
    """
    Return the active DB connection.
    Named 'get_pool' for compatibility — callers use 'async with pool.acquire()'.
    """
    if _db is None:
        raise RuntimeError("Database is not available.")
    return _DBProxy(_db)


# ── Proxy: makes aiosqlite look like asyncpg ───────────────────────────────────

class _DBProxy:
    """
    Mimics the asyncpg pool interface so existing code works unchanged:
        pool = await get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(...)
    """
    def __init__(self, conn: aiosqlite.Connection):
        self._conn = conn

    def acquire(self):
        return _ConnCtx(self._conn)


class _ConnCtx:
    def __init__(self, conn):
        self._conn = conn

    async def __aenter__(self):
        return _Conn(self._conn)

    async def __aexit__(self, *_):
        pass


class _Conn:
    def __init__(self, conn: aiosqlite.Connection):
        self._conn = conn

    @staticmethod
    def _pg_to_sqlite(sql: str) -> str:
        """Convert asyncpg $1..$N placeholders to SQLite ? placeholders."""
        import re
        return re.sub(r'\$\d+', '?', sql)

    async def execute(self, sql: str, *args) -> str:
        sql = self._pg_to_sqlite(sql)
        # Flatten: asyncpg passes args individually or as a tuple
        params = args[0] if len(args) == 1 and isinstance(args[0], (list, tuple)) else args
        cur = await self._conn.execute(sql, params)
        await self._conn.commit()
        return f"OK {cur.rowcount}"

    async def executemany(self, sql: str, params_list):
        sql = self._pg_to_sqlite(sql)
        await self._conn.executemany(sql, params_list)
        await self._conn.commit()

    async def fetchrow(self, sql: str, *args):
        sql = self._pg_to_sqlite(sql)
        params = args[0] if len(args) == 1 and isinstance(args[0], (list, tuple)) else args
        async with self._conn.execute(sql, params) as cur:
            row = await cur.fetchone()
        if row is None:
            return None
        return _Row(row)

    async def fetch(self, sql: str, *args):
        sql = self._pg_to_sqlite(sql)
        params = args[0] if len(args) == 1 and isinstance(args[0], (list, tuple)) else args
        async with self._conn.execute(sql, params) as cur:
            rows = await cur.fetchall()
        return [_Row(r) for r in rows]


class _Row:
    """
    Wraps aiosqlite.Row to behave like asyncpg.Record.

    dict(row) works because we implement the Mapping protocol:
    keys() + __getitem__ is enough for dict() to work.
    """
    def __init__(self, row):
        self._row  = row
        self._data = dict(zip(row.keys(), row))   # materialise once

    def __getitem__(self, key):
        return self._data[key]

    def get(self, key, default=None):
        return self._data.get(key, default)

    def __contains__(self, key):
        return key in self._data

    def keys(self):
        return self._data.keys()

    def values(self):
        return self._data.values()

    def items(self):
        return self._data.items()

    def __iter__(self):
        return iter(self._data)

    def __len__(self):
        return len(self._data)

    def __repr__(self):
        return f"Row({self._data})"
