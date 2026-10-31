"""
database_service.py
All PostgreSQL queries for the document verifier.

Every blockchain action is mirrored here so the system can:
  - Verify documents even when the Hardhat node is not running
  - Look up documents instantly without an RPC call
  - Keep a persistent audit trail
"""

import asyncpg
from app.db import get_pool


async def save_document(
    document_id: str,
    cid: str,
    issuer: str,
    timestamp: int,
    tx_hash: str,
    ipfs_url: str,
    filename: str = "",
) -> None:
    """
    Insert a newly registered document into PostgreSQL.
    Silently ignores duplicate document_id (ON CONFLICT DO NOTHING).
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO documents
                (document_id, cid, issuer, timestamp, valid, tx_hash, ipfs_url, filename)
            VALUES
                ($1, $2, $3, $4, TRUE, $5, $6, $7)
            ON CONFLICT (document_id) DO NOTHING;
            """,
            document_id, cid, issuer, timestamp, tx_hash, ipfs_url, filename,
        )


async def get_document(document_id: str) -> dict | None:
    """
    Fetch a document record from PostgreSQL.
    Returns None if not found.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        row: asyncpg.Record | None = await conn.fetchrow(
            "SELECT * FROM documents WHERE document_id = $1;",
            document_id,
        )

    if row is None:
        return None

    return dict(row)


async def verify_document(document_id: str, cid: str) -> bool | None:
    """
    Verify a document using the PostgreSQL record.

    Returns:
        True   — CID matches and document is valid
        False  — CID mismatch or document revoked
        None   — document not found in DB (caller should fall back to chain)
    """
    row = await get_document(document_id)
    if row is None:
        return None  # not in DB — fall back to blockchain

    return row["cid"] == cid and row["valid"]


async def revoke_document(document_id: str) -> bool:
    """
    Mark a document as revoked in PostgreSQL.

    Returns True if a row was updated, False if not found.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            """
            UPDATE documents
            SET valid = FALSE, updated_at = NOW()
            WHERE document_id = $1;
            """,
            document_id,
        )
    # Our SQLite shim returns "OK <n>"; asyncpg returned "UPDATE <n>"
    return "1" in (result or "")


async def list_documents() -> list[dict]:
    """Return all documents ordered by registration time (newest first)."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM documents ORDER BY created_at DESC;"
        )
    return [dict(r) for r in rows]
