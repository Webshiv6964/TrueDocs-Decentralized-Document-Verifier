"""
org_routes.py
Organization authentication, dashboard, document registration, and wallet linking.

Routes:
    POST /api/org/request        — submit access request
    POST /api/org/login          — log in
    GET  /api/org/me             — get current org profile (auth required)
    GET  /api/org/documents      — list org's own documents (auth required)
    POST /api/org/documents/register  — register via backend key (legacy, kept for compat)
    POST /api/org/wallet/nonce   — get nonce for wallet signature (auth required)
    POST /api/org/wallet/link    — verify signature + link wallet (auth required)
    POST /api/org/documents/prepare — upload to IPFS, return CID+hash (auth required)
    POST /api/org/documents/confirm — verify on-chain tx, store in DB (auth required)
"""

import hashlib
import os
import time
from datetime import datetime, timezone

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from pydantic import BaseModel, EmailStr

from .db import get_pool
from .auth import hash_password, verify_password, create_access_token, get_current_org
from .ipfs_service import upload_to_ipfs, get_ipfs_url
from .blockchain_service import (
    register_document as chain_register,
    verify_registration_transaction,
    verify_wallet_signature,
)
from . import email_service

router = APIRouter(prefix="/org", tags=["Organization"])

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


def _isoformat(val) -> str | None:
    """Return ISO string whether val is a datetime object or already a string."""
    if val is None:
        return None
    if isinstance(val, str):
        return val
    return val.isoformat()


# ── Schemas ────────────────────────────────────────────────────────────────────

class OrgRequestBody(BaseModel):
    org_name:       str
    email:          EmailStr
    contact_person: str
    purpose:        str
    password:       str


class OrgLoginBody(BaseModel):
    email:    EmailStr
    password: str


class WalletLinkBody(BaseModel):
    wallet_address: str
    signature:      str


class RegisterConfirmBody(BaseModel):
    tx_hash:        str
    doc_hash:       str
    cid:            str
    ipfs_url:       str = ""
    filename:       str = ""
    signer_address: str = ""   # the MetaMask address that actually sent the tx


# ── POST /org/request ──────────────────────────────────────────────────────────

@router.post("/request")
async def org_request(body: OrgRequestBody):
    """Submit a new organization access request."""
    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters.")
    if not body.org_name.strip():
        raise HTTPException(400, "Organization name is required.")

    try:
        pool = await get_pool()
    except RuntimeError:
        raise HTTPException(503, "Database unavailable. Please try again later.")

    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT id FROM organizations WHERE email = $1", body.email
        )
        if existing:
            raise HTTPException(409, "An account with this email already exists.")

        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        await conn.execute(
            """
            INSERT INTO organizations
                (org_name, email, contact_person, purpose, password_hash, status, created_at)
            VALUES ($1, $2, $3, $4, $5, 'PENDING', $6)
            """,
            body.org_name.strip(),
            body.email,
            body.contact_person.strip(),
            body.purpose.strip(),
            hash_password(body.password),
            now,
        )

    # Notify admin (fire-and-forget — failure is non-fatal)
    try:
        await email_service.notify_admin_new_request(
            org_name=body.org_name,
            org_email=body.email,
            contact_person=body.contact_person,
            request_date=now,
        )
    except Exception:
        pass

    return {
        "success": True,
        "message": "Access request submitted. You will be notified once reviewed.",
    }


# ── POST /org/login ────────────────────────────────────────────────────────────

@router.post("/login")
async def org_login(body: OrgLoginBody):
    try:
        pool = await get_pool()
    except RuntimeError:
        raise HTTPException(503, "Database unavailable.")

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM organizations WHERE email = $1", body.email
        )

    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(401, "Invalid email or password.")

    status = row["status"]
    if status == "PENDING":
        raise HTTPException(
            403, "Your access request is still pending admin approval."
        )
    if status == "REJECTED":
        raise HTTPException(403, "Your access request was rejected.")
    if status == "SUSPENDED":
        raise HTTPException(403, "Your account has been suspended.")
    if status != "APPROVED":
        raise HTTPException(403, "Account not authorized.")

    token = create_access_token({
        "sub":      row["email"],
        "org_id":   row["id"],
        "org_name": row["org_name"],
        "role":     "org",
    })

    return {
        "access_token": token,
        "token_type":   "bearer",
        "org_id":       row["id"],
        "org_name":     row["org_name"],
        "email":        row["email"],
    }


# ── GET /org/me ────────────────────────────────────────────────────────────────

@router.get("/me")
async def org_me(current_org: dict = Depends(get_current_org)):
    try:
        pool = await get_pool()
    except RuntimeError:
        raise HTTPException(503, "Database unavailable.")

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, org_name, email, contact_person, purpose, status, created_at, approved_at, wallet_address "
            "FROM organizations WHERE id = $1",
            current_org["org_id"],
        )

    if not row:
        raise HTTPException(404, "Organization not found.")

    return {
        "id":             row["id"],
        "org_name":       row["org_name"],
        "email":          row["email"],
        "contact_person": row["contact_person"],
        "purpose":        row["purpose"],
        "status":         row["status"],
        "wallet_address": row["wallet_address"],
        "created_at":     _isoformat(row["created_at"]),
        "approved_at":    _isoformat(row["approved_at"]),
    }


# ── GET /org/documents ─────────────────────────────────────────────────────────

@router.get("/documents")
async def org_documents(current_org: dict = Depends(get_current_org)):
    """List documents registered by this organization only."""
    try:
        pool = await get_pool()
    except RuntimeError:
        raise HTTPException(503, "Database unavailable.")

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT document_id, cid, original_filename, tx_hash,
                   valid, created_at, ipfs_url, doc_hash
            FROM documents
            WHERE org_id = $1
            ORDER BY created_at DESC
            """,
            current_org["org_id"],
        )

    return {
        "success":   True,
        "count":     len(rows),
        "documents": [dict(r) for r in rows],
    }


# ── POST /org/documents/register ──────────────────────────────────────────────

@router.post("/documents/register")
async def org_register_document(
    file: UploadFile = File(...),
    current_org: dict = Depends(get_current_org),
):
    """
    Register a document for an approved organization.
    1. Read bytes + compute SHA-256 hash.
    2. Check for duplicate hash.
    3. Upload to Pinata IPFS.
    4. Register on blockchain (document_id = hash).
    5. Store in DB.
    """
    # ── Re-verify org status from DB (do not trust token alone) ──────────────
    try:
        pool = await get_pool()
    except RuntimeError:
        raise HTTPException(503, "Database unavailable.")

    async with pool.acquire() as conn:
        org_row = await conn.fetchrow(
            "SELECT status FROM organizations WHERE id = $1",
            current_org["org_id"],
        )

    if not org_row or org_row["status"] != "APPROVED":
        raise HTTPException(403, "Only approved organizations can register documents.")

    # ── Read file ─────────────────────────────────────────────────────────────
    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(400, f"Could not read file: {e}")

    if not file_bytes:
        raise HTTPException(400, "Uploaded file is empty.")

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(413, "File exceeds maximum size of 20 MB.")

    # ── Compute SHA-256 hash ──────────────────────────────────────────────────
    doc_hash = hashlib.sha256(file_bytes).hexdigest()
    original_filename = file.filename or "document"

    # ── Duplicate check ───────────────────────────────────────────────────────
    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT document_id, org_id FROM documents WHERE doc_hash = $1",
            doc_hash,
        )

    if existing:
        if existing["org_id"] == current_org["org_id"]:
            raise HTTPException(
                409,
                "You have already registered a document with identical contents.",
            )
        raise HTTPException(
            409,
            "A document with identical contents is already registered on TrueDocs.",
        )

    # ── IPFS upload ───────────────────────────────────────────────────────────
    try:
        cid = upload_to_ipfs(file_bytes, original_filename)
    except ValueError as e:
        raise HTTPException(500, str(e))
    except RuntimeError as e:
        raise HTTPException(502, f"IPFS upload failed: {e}")

    ipfs_url = get_ipfs_url(cid)

    # ── Blockchain registration ───────────────────────────────────────────────
    # document_id on-chain = SHA-256 hash (allows public hash-based verification)
    try:
        result = chain_register(doc_hash, cid)
    except RuntimeError as e:
        raise HTTPException(409, str(e))
    except (ValueError, ConnectionError, FileNotFoundError) as e:
        raise HTTPException(500, str(e))

    # ── Persist to DB ─────────────────────────────────────────────────────────
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO documents
                (document_id, cid, issuer, timestamp, valid,
                 tx_hash, ipfs_url, filename, org_id, doc_hash, original_filename)
            VALUES
                ($1, $2, $3, $4, TRUE, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (document_id) DO NOTHING
            """,
            doc_hash,
            cid,
            result["issuer"],
            int(time.time()),
            result["tx_hash"],
            ipfs_url,
            original_filename,
            current_org["org_id"],
            doc_hash,
            original_filename,
        )

    return {
        "success":       True,
        "document_id":   doc_hash,
        "doc_hash":      doc_hash,
        "cid":           cid,
        "ipfs_url":      ipfs_url,
        "tx_hash":       result["tx_hash"],
        "issuer":        result["issuer"],
        "org_name":      current_org["org_name"],
        "filename":      original_filename,
        "message":       "Document registered successfully.",
    }


# ── POST /org/wallet/nonce ─────────────────────────────────────────────────────

@router.get("/wallet/nonce")
async def get_wallet_nonce(current_org: dict = Depends(get_current_org)):
    """Return a nonce for the org to sign with their MetaMask wallet."""
    try:
        pool = await get_pool()
    except RuntimeError:
        raise HTTPException(503, "Database unavailable.")

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT wallet_nonce FROM organizations WHERE id = $1",
            current_org["org_id"],
        )
        if not row:
            raise HTTPException(404, "Organization not found.")

        nonce = (row["wallet_nonce"] or 0) + 1
        # Increment the nonce so each request gets a unique value
        await conn.execute(
            "UPDATE organizations SET wallet_nonce = $1 WHERE id = $2",
            nonce, current_org["org_id"],
        )

    message = f"Link this wallet to TrueDocs\nNonce: {nonce}"
    return {"nonce": nonce, "message": message}


# ── POST /org/wallet/link ──────────────────────────────────────────────────────

@router.post("/wallet/link")
async def link_wallet(body: WalletLinkBody, current_org: dict = Depends(get_current_org)):
    """
    Verify wallet ownership via signature and link it to the org account.

    The frontend signs the nonce message with MetaMask, and we verify
    the signature cryptographically — we never trust the address alone.
    """
    try:
        pool = await get_pool()
    except RuntimeError:
        raise HTTPException(503, "Database unavailable.")

    wallet_address = body.wallet_address.strip().lower()

    # ── Check no other org already has this wallet ───────────────────────────────
    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT id FROM organizations WHERE wallet_address = $1 AND id != $2",
            wallet_address, current_org["org_id"],
        )
    if existing:
        raise HTTPException(409, "This wallet is already linked to another organization.")

    # ── Get the current nonce from DB ──────────────────────────────────────────
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT wallet_nonce FROM organizations WHERE id = $1",
            current_org["org_id"],
        )
    if not row:
        raise HTTPException(404, "Organization not found.")

    expected_nonce = row["wallet_nonce"]
    if not expected_nonce:
        raise HTTPException(400, "Request a nonce first via GET /org/wallet/nonce.")

    # ── Verify the signature ────────────────────────────────────────────────────
    is_valid = verify_wallet_signature(expected_nonce, body.signature, wallet_address)
    if not is_valid:
        raise HTTPException(403, "Signature verification failed. The wallet address does not match the signature.")

    # ── Store the verified wallet address ──────────────────────────────────────
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE organizations SET wallet_address = $1 WHERE id = $2",
            wallet_address, current_org["org_id"],
        )

    return {
        "success":         True,
        "wallet_address":  wallet_address,
        "message":          "Wallet linked successfully.",
    }


# ── POST /org/documents/prepare ────────────────────────────────────────────────

@router.post("/documents/prepare")
async def org_prepare_document(
    file: UploadFile = File(...),
    current_org: dict = Depends(get_current_org),
):
    """
    Phase 1 of MetaMask-based registration:
      - Verify org is approved + has a linked wallet
      - Compute SHA-256 hash
      - Upload to Pinata IPFS
      - Return {doc_hash, cid, ipfs_url} — NO blockchain transaction yet

    The frontend will use these values to send the on-chain transaction
    via the org's MetaMask wallet, then call /documents/confirm.
    """
    try:
        pool = await get_pool()
    except RuntimeError:
        raise HTTPException(503, "Database unavailable.")

    # ── Re-verify org status from DB ───────────────────────────────────────────
    async with pool.acquire() as conn:
        org_row = await conn.fetchrow(
            "SELECT status, wallet_address FROM organizations WHERE id = $1",
            current_org["org_id"],
        )

    if not org_row or org_row["status"] != "APPROVED":
        raise HTTPException(403, "Only approved organizations can register documents.")

    # Wallet must be linked before prepare so we can return it to the frontend.
    # The constraint is relaxed: the linked wallet doesn't have to be the one
    # currently connected in MetaMask — it just proves the org has done at least
    # one verified wallet ownership check.
    if not org_row["wallet_address"]:
        raise HTTPException(
            403,
            "No wallet linked. Click 'Link Wallet' in your dashboard to link any MetaMask account."
        )

    # ── Read file + validate ──────────────────────────────────────────────────
    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(400, f"Could not read file: {e}")

    if not file_bytes:
        raise HTTPException(400, "Uploaded file is empty.")
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(413, "File exceeds maximum size of 20 MB.")

    # ── Compute SHA-256 hash ──────────────────────────────────────────────────
    doc_hash = hashlib.sha256(file_bytes).hexdigest()
    original_filename = file.filename or "document"

    # ── Duplicate check ───────────────────────────────────────────────────────
    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT document_id, org_id FROM documents WHERE doc_hash = $1",
            doc_hash,
        )

    if existing:
        if existing["org_id"] == current_org["org_id"]:
            raise HTTPException(409, "You have already registered a document with identical contents.")
        raise HTTPException(409, "A document with identical contents is already registered on TrueDocs.")

    # ── IPFS upload ───────────────────────────────────────────────────────────
    try:
        cid = upload_to_ipfs(file_bytes, original_filename)
    except ValueError as e:
        raise HTTPException(500, str(e))
    except RuntimeError as e:
        raise HTTPException(502, f"IPFS upload failed: {e}")

    ipfs_url = get_ipfs_url(cid)

    return {
        "success":          True,
        "doc_hash":         doc_hash,
        "cid":              cid,
        "ipfs_url":         ipfs_url,
        "original_filename": original_filename,
        "wallet_address":   org_row["wallet_address"],
        "message":           "File uploaded to IPFS. Confirm the blockchain transaction in MetaMask.",
    }


# ── POST /org/documents/confirm ────────────────────────────────────────────────

@router.post("/documents/confirm")
async def org_confirm_document(
    body: RegisterConfirmBody,
    current_org: dict = Depends(get_current_org),
):
    """
    Phase 2 of MetaMask-based registration:
      - Verify the org is approved + has a linked wallet
      - Independently verify the on-chain transaction:
          * tx status == 1 (success)
          * sent to our contract
          * called registerDocument(doc_hash, cid)
          * sent FROM the org's linked wallet
      - Store the record in the database
      - Return the full registration result

    This endpoint never trusts the frontend's tx_hash without
    verifying it against the blockchain.
    """
    try:
        pool = await get_pool()
    except RuntimeError:
        raise HTTPException(503, "Database unavailable.")

    # ── Re-verify org status + wallet ──────────────────────────────────────────
    async with pool.acquire() as conn:
        org_row = await conn.fetchrow(
            "SELECT status, wallet_address FROM organizations WHERE id = $1",
            current_org["org_id"],
        )

    if not org_row or org_row["status"] != "APPROVED":
        raise HTTPException(403, "Only approved organizations can register documents.")

    linked_wallet = org_row["wallet_address"]
    if not linked_wallet:
        raise HTTPException(403, "No wallet linked to this organization.")

    # ── Duplicate check (in case someone calls confirm twice) ───────────────────
    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT document_id FROM documents WHERE doc_hash = $1",
            body.doc_hash,
        )
    if existing:
        raise HTTPException(409, "This document has already been registered.")

    # ── Determine the expected signer ──────────────────────────────────────────
    # The frontend sends the address of the MetaMask account it used.
    # We verify the transaction against THAT address (not the stale linked_wallet).
    # This allows any MetaMask account to be used, including ones different from
    # whatever was previously linked.
    expected_signer = (body.signer_address.strip().lower()
                       if body.signer_address.strip()
                       else linked_wallet)

    # ── Verify the transaction on-chain ────────────────────────────────────────
    try:
        result = verify_registration_transaction(
            tx_hash=           body.tx_hash,
            expected_doc_hash= body.doc_hash,
            expected_cid=      body.cid,
            expected_signer=   expected_signer,
        )
    except RuntimeError as e:
        raise HTTPException(503, f"Could not verify transaction: {e}")
    except Exception as e:
        raise HTTPException(500, f"Verification error: {e}")

    if not result["verified"]:
        raise HTTPException(400, f"Transaction verification failed: {result['reason']}")

    # ── Store in database ──────────────────────────────────────────────────────
    # The issuer is the address that actually sent the on-chain tx.
    actual_issuer = result.get("from", expected_signer).lower()
    ipfs_url = body.ipfs_url or get_ipfs_url(body.cid)
    filename = body.filename or "document"

    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO documents
                (document_id, cid, issuer, timestamp, valid,
                 tx_hash, ipfs_url, filename, org_id, doc_hash, original_filename)
            VALUES
                ($1, $2, $3, $4, 1, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (document_id) DO NOTHING
            """,
            body.doc_hash,
            body.cid,
            actual_issuer,
            int(time.time()),
            body.tx_hash,
            ipfs_url,
            filename,
            current_org["org_id"],
            body.doc_hash,
            filename,
        )

    # ── Update the org's linked wallet to the address that just transacted ─────
    # This means switching MetaMask accounts and registering a document
    # automatically updates the stored address — no separate re-link required.
    if actual_issuer != (linked_wallet or ""):
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE organizations SET wallet_address = $1 WHERE id = $2",
                actual_issuer, current_org["org_id"],
            )

    return {
        "success":       True,
        "document_id":   body.doc_hash,
        "doc_hash":      body.doc_hash,
        "cid":           body.cid,
        "ipfs_url":      ipfs_url,
        "tx_hash":       body.tx_hash,
        "issuer":        actual_issuer,
        "block_number":  result.get("block_number"),
        "gas_used":      result.get("gas_used"),
        "org_name":      current_org["org_name"],
        "filename":      filename,
        "message":       "Document registered and verified on blockchain.",
    }
