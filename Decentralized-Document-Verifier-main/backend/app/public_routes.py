"""
public_routes.py
Public endpoints - no authentication required.

Routes:
    POST /api/public/verify            - verify document by file upload (SHA-256 hash)
    GET  /api/public/document/{hash}   - look up document record by hash
    GET  /api/public/blockchain-config - contract address + chain config for MetaMask
"""

import hashlib
import os

from fastapi import APIRouter, UploadFile, File, HTTPException

from .db import get_pool
from .blockchain_service import verify_document as chain_verify, get_document as chain_get

router = APIRouter(prefix="/public", tags=["Public"])

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


def _iso(val):
    """Return ISO string whether val is a datetime object or already a string."""
    if val is None:
        return None
    return val if isinstance(val, str) else val.isoformat()


# ── GET /public/blockchain-config ─────────────────────────────────────────────

@router.get("/blockchain-config")
async def blockchain_config():
    """
    Return the contract address, chain ID, and RPC URL.
    The frontend uses this to configure MetaMask + ethers.js.
    """
    return {
        "contract_address": os.getenv("CONTRACT_ADDRESS", ""),
        "chain_id":         31337,
        "chain_name":       "Hardhat Local",
        "rpc_url":          os.getenv("RPC_URL", "http://127.0.0.1:8545"),
    }


# ── POST /public/verify ───────────────────────────────────────────────────────

@router.post("/verify")
async def public_verify(file: UploadFile = File(...)):
    """
    Public document verification.
    Caller uploads the original file; backend computes SHA-256 hash and
    checks the blockchain registry. No login or document ID required.
    """
    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(400, f"Could not read file: {e}")

    if not file_bytes:
        raise HTTPException(400, "File is empty.")
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(413, "File exceeds 20 MB limit.")

    doc_hash = hashlib.sha256(file_bytes).hexdigest()

    # ── DB fast-path ──────────────────────────────────────────────────────────
    db_row = None
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            db_row = await conn.fetchrow(
                (
                    "SELECT d.document_id, d.cid, d.valid, d.created_at, "
                    "       d.original_filename, d.ipfs_url, o.org_name "
                    "FROM documents d "
                    "LEFT JOIN organizations o ON d.org_id = o.id "
                    "WHERE d.doc_hash = $1"
                ),
                doc_hash,
            )
    except RuntimeError:
        pass  # DB unavailable — fall through to blockchain

    if db_row is not None:
        if not db_row["valid"]:
            return {
                "result":        "invalid",
                "status":        "REVOKED",
                "message":       "This document has been revoked and is no longer valid.",
                "doc_hash":      doc_hash,
                "registered_by": db_row["org_name"] or "Unknown",
                "registered_at": _iso(db_row["created_at"]),
                "source":        "database",
            }

        try:
            is_valid = chain_verify(db_row["document_id"], db_row["cid"])
            if is_valid:
                return {
                    "result":        "verified",
                    "status":        "VALID",
                    "message":       "Document is registered and its contents match the original.",
                    "doc_hash":      doc_hash,
                    "cid":           db_row["cid"],
                    "ipfs_url":      db_row["ipfs_url"],
                    "registered_by": db_row["org_name"] or "Unknown",
                    "registered_at": _iso(db_row["created_at"]),
                    "filename":      db_row["original_filename"],
                    "source":        "database+blockchain",
                }
            return {
                "result":   "invalid",
                "status":   "INVALID",
                "message":  "Document record exists but verification failed on the blockchain.",
                "doc_hash": doc_hash,
                "source":   "database+blockchain",
            }
        except Exception:
            return {
                "result":        "verified",
                "status":        "VALID",
                "message":       "Document is registered (blockchain unavailable — trusted DB record).",
                "doc_hash":      doc_hash,
                "cid":           db_row["cid"],
                "ipfs_url":      db_row["ipfs_url"],
                "registered_by": db_row["org_name"] or "Unknown",
                "registered_at": _iso(db_row["created_at"]),
                "filename":      db_row["original_filename"],
                "source":        "database",
            }

    # ── Blockchain fallback ───────────────────────────────────────────────────
    try:
        doc = chain_get(doc_hash)
        if not doc["valid"]:
            return {
                "result":   "invalid",
                "status":   "REVOKED",
                "message":  "This document has been revoked.",
                "doc_hash": doc_hash,
                "source":   "blockchain",
            }
        return {
            "result":   "verified",
            "status":   "VALID",
            "message":  "Document is registered and verified on the blockchain.",
            "doc_hash": doc_hash,
            "cid":      doc["cid"],
            "source":   "blockchain",
        }
    except RuntimeError as e:
        if "not found" in str(e).lower():
            return {
                "result":   "not_found",
                "status":   "NOT_FOUND",
                "message":  "No record found for this document. It has not been registered.",
                "doc_hash": doc_hash,
            }
        return {
            "result":   "error",
            "status":   "ERROR",
            "message":  "Verification service temporarily unavailable. Please try again.",
            "doc_hash": doc_hash,
        }
    except Exception:
        return {
            "result":   "error",
            "status":   "ERROR",
            "message":  "Verification service temporarily unavailable. Please try again.",
            "doc_hash": doc_hash,
        }


# ── GET /public/document/{doc_hash} ──────────────────────────────────────────

@router.get("/document/{doc_hash}")
async def public_get_document(doc_hash: str):
    """
    Return safe public information about a registered document.
    Never exposes org credentials, admin info, or private keys.
    """
    if len(doc_hash) != 64 or not all(c in "0123456789abcdef" for c in doc_hash.lower()):
        raise HTTPException(400, "Invalid document hash format.")

    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                (
                    "SELECT d.cid, d.valid, d.created_at, d.original_filename, "
                    "       d.ipfs_url, o.org_name "
                    "FROM documents d "
                    "LEFT JOIN organizations o ON d.org_id = o.id "
                    "WHERE d.doc_hash = $1"
                ),
                doc_hash.lower(),
            )
        if row:
            return {
                "found":         True,
                "doc_hash":      doc_hash,
                "cid":           row["cid"],
                "valid":         bool(row["valid"]),
                "registered_by": row["org_name"] or "Unknown",
                "registered_at": _iso(row["created_at"]),
                "filename":      row["original_filename"],
                "ipfs_url":      row["ipfs_url"],
            }
    except RuntimeError:
        pass

    try:
        doc = chain_get(doc_hash)
        return {
            "found":    True,
            "doc_hash": doc_hash,
            "cid":      doc["cid"],
            "valid":    doc["valid"],
            "source":   "blockchain",
        }
    except RuntimeError as e:
        if "not found" in str(e).lower():
            return {"found": False, "doc_hash": doc_hash}
        raise HTTPException(503, "Lookup service unavailable.")
