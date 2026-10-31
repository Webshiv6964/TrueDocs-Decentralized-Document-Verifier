"""
routes.py
REST API endpoints for the Document Verifier.

Flow:
  register  → IPFS upload → blockchain → PostgreSQL mirror
  verify    → PostgreSQL first (fast) → fallback to blockchain if not in DB
  get       → PostgreSQL first → fallback to blockchain
  revoke    → blockchain → PostgreSQL mirror

Endpoints:
    POST /api/documents/register
    POST /api/documents/verify
    GET  /api/documents/{document_id}
    POST /api/documents/revoke
    GET  /api/documents               (list all from DB)
"""

import time

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel

from . import ipfs_service, blockchain_service, database_service

router = APIRouter(prefix="/documents", tags=["Documents"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class VerifyRequest(BaseModel):
    document_id: str
    cid: str


class RevokeRequest(BaseModel):
    document_id: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _format_db_doc(row: dict) -> dict:
    """Convert a DB row to the same shape as a blockchain response."""
    return {
        "documentId": row["document_id"],
        "cid":        row["cid"],
        "issuer":     row["issuer"],
        "timestamp":  row["timestamp"],
        "valid":      row["valid"],
    }


# ── POST /register ────────────────────────────────────────────────────────────

@router.post("/register")
async def register_document(
    document_id: str  = Form(..., description="Unique identifier for the document"),
    file: UploadFile  = File(..., description="The document file to upload"),
):
    """
    1. Read uploaded file bytes.
    2. Upload to IPFS via Pinata → get CID.
    3. Register CID on blockchain (smart contract).
    4. Save record to PostgreSQL.
    """
    # ── 1. Read file ─────────────────────────────────────────────────────────
    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read file: {e}")

    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # ── 2. IPFS upload ───────────────────────────────────────────────────────
    try:
        cid = ipfs_service.upload_to_ipfs(file_bytes, file.filename or "document")
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=f"IPFS upload failed: {e}")

    ipfs_url = ipfs_service.get_ipfs_url(cid)

    # ── 3. Blockchain ────────────────────────────────────────────────────────
    try:
        result = blockchain_service.register_document(document_id, cid)
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except (ValueError, ConnectionError, FileNotFoundError) as e:
        raise HTTPException(status_code=500, detail=str(e))

    # ── 4. PostgreSQL mirror ─────────────────────────────────────────────────
    try:
        await database_service.save_document(
            document_id=document_id,
            cid=cid,
            issuer=result["issuer"],
            timestamp=int(time.time()),
            tx_hash=result["tx_hash"],
            ipfs_url=ipfs_url,
            filename=file.filename or "",
        )
    except Exception as e:
        # DB write failing should not break the response — blockchain is source of truth
        print(f"[WARN] PostgreSQL mirror failed for {document_id}: {e}")

    return {
        "success":     True,
        "document_id": document_id,
        "cid":         cid,
        "ipfs_url":    ipfs_url,
        "tx_hash":     result["tx_hash"],
        "issuer":      result["issuer"],
        "message":     "Document registered successfully",
    }


# ── POST /verify ──────────────────────────────────────────────────────────────

@router.post("/verify")
async def verify_document(body: VerifyRequest):
    """
    Verify by checking PostgreSQL first (instant), then falling back to
    the blockchain if the document is not cached in the DB.
    """
    # ── Try DB first ─────────────────────────────────────────────────────────
    try:
        db_result = await database_service.verify_document(body.document_id, body.cid)
    except Exception as e:
        print(f"[WARN] DB verify failed, falling back to chain: {e}")
        db_result = None

    if db_result is not None:
        # Found in DB — return immediately
        is_verified = db_result
        source = "database"
    else:
        # Not in DB — ask the blockchain
        try:
            is_verified = blockchain_service.verify_document(body.document_id, body.cid)
            source = "blockchain"
        except RuntimeError as e:
            error_msg = str(e).lower()
            if "not found" in error_msg:
                raise HTTPException(
                    status_code=404,
                    detail=f"Document '{body.document_id}' not found.",
                )
            raise HTTPException(status_code=500, detail=str(e))
        except (ValueError, ConnectionError, FileNotFoundError) as e:
            raise HTTPException(status_code=500, detail=str(e))

    return {
        "verified": is_verified,
        "status":   "VALID" if is_verified else "INVALID",
        "source":   source,
        "message":  (
            "CID matches the blockchain record."
            if is_verified
            else "CID does not match or the document has been revoked."
        ),
    }


# ── GET /{document_id} ────────────────────────────────────────────────────────

@router.get("/all")
async def list_documents():
    """List all registered documents from PostgreSQL."""
    try:
        rows = await database_service.list_documents()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"success": True, "count": len(rows), "documents": rows}


@router.get("/{document_id}")
async def get_document(document_id: str):
    """
    Fetch document details — PostgreSQL first, blockchain fallback.
    """
    # ── Try DB first ─────────────────────────────────────────────────────────
    try:
        row = await database_service.get_document(document_id)
    except Exception as e:
        print(f"[WARN] DB get failed, falling back to chain: {e}")
        row = None

    if row is not None:
        return {
            "success":  True,
            "document": _format_db_doc(row),
            "ipfs_url": row.get("ipfs_url") or ipfs_service.get_ipfs_url(row["cid"]),
            "source":   "database",
        }

    # ── Fallback to blockchain ────────────────────────────────────────────────
    try:
        doc = blockchain_service.get_document(document_id)
    except RuntimeError as e:
        error_msg = str(e).lower()
        if "not found" in error_msg:
            raise HTTPException(
                status_code=404,
                detail=f"Document '{document_id}' not found.",
            )
        raise HTTPException(status_code=500, detail=str(e))
    except (ValueError, ConnectionError, FileNotFoundError) as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "success":  True,
        "document": doc,
        "ipfs_url": ipfs_service.get_ipfs_url(doc["cid"]),
        "source":   "blockchain",
    }


# ── POST /revoke ──────────────────────────────────────────────────────────────

@router.post("/revoke")
async def revoke_document(body: RevokeRequest):
    """
    Revoke on blockchain, then mirror the revocation in PostgreSQL.
    """
    # ── Blockchain revoke ─────────────────────────────────────────────────────
    try:
        result = blockchain_service.revoke_document(body.document_id)
    except RuntimeError as e:
        error_msg = str(e).lower()
        if "not found" in error_msg:
            raise HTTPException(status_code=404, detail=f"Document '{body.document_id}' not found.")
        if "not authorized" in error_msg:
            raise HTTPException(status_code=403, detail="Not authorized to revoke this document.")
        if "already revoked" in error_msg:
            raise HTTPException(status_code=409, detail="Document already revoked.")
        raise HTTPException(status_code=500, detail=str(e))
    except (ValueError, ConnectionError, FileNotFoundError) as e:
        raise HTTPException(status_code=500, detail=str(e))

    # ── Mirror in DB ──────────────────────────────────────────────────────────
    try:
        await database_service.revoke_document(body.document_id)
    except Exception as e:
        print(f"[WARN] DB revoke mirror failed for {body.document_id}: {e}")

    return {
        "success":     True,
        "document_id": body.document_id,
        "tx_hash":     result["tx_hash"],
        "message":     "Document revoked successfully.",
    }
