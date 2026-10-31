"""
admin_routes.py
Single-admin endpoints for reviewing and managing organization requests.

Routes:
    POST /api/admin/login
    GET  /api/admin/orgs            — list all organizations
    POST /api/admin/orgs/{id}/approve
    POST /api/admin/orgs/{id}/reject
"""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from .db import get_pool
from .auth import verify_password, create_access_token, get_current_admin
from . import email_service

router = APIRouter(prefix="/admin", tags=["Admin"])


def _isoformat(val):
    if val is None:
        return None
    if isinstance(val, str):
        return val
    return val.isoformat()


# ── Schemas ────────────────────────────────────────────────────────────────────

class AdminLoginBody(BaseModel):
    email:    str
    password: str


# ── POST /admin/login ──────────────────────────────────────────────────────────

@router.post("/login")
async def admin_login(body: AdminLoginBody):
    try:
        pool = await get_pool()
    except RuntimeError:
        raise HTTPException(503, "Database unavailable.")

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM admin WHERE email = $1", body.email
        )

    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(401, "Invalid admin credentials.")

    token = create_access_token({"sub": row["email"], "role": "admin"})

    return {
        "access_token": token,
        "token_type":   "bearer",
        "email":        row["email"],
    }


# ── GET /admin/orgs ────────────────────────────────────────────────────────────

@router.get("/orgs")
async def list_orgs(current_admin: dict = Depends(get_current_admin)):
    try:
        pool = await get_pool()
    except RuntimeError:
        raise HTTPException(503, "Database unavailable.")

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, org_name, email, contact_person, purpose,
                   status, created_at, approved_at, rejected_at
            FROM organizations
            ORDER BY created_at DESC
            """
        )

    orgs = []
    for r in rows:
        orgs.append({
            "id":             r["id"],
            "org_name":       r["org_name"],
            "email":          r["email"],
            "contact_person": r["contact_person"],
            "purpose":        r["purpose"],
            "status":         r["status"],
            "created_at":     _isoformat(r["created_at"]),
            "approved_at":    _isoformat(r["approved_at"]),
            "rejected_at":    _isoformat(r["rejected_at"]),
        })

    pending  = [o for o in orgs if o["status"] == "PENDING"]
    approved = [o for o in orgs if o["status"] == "APPROVED"]
    rejected = [o for o in orgs if o["status"] == "REJECTED"]

    return {
        "total":    len(orgs),
        "pending":  pending,
        "approved": approved,
        "rejected": rejected,
    }


# ── POST /admin/orgs/{id}/approve ─────────────────────────────────────────────

@router.post("/orgs/{org_id}/approve")
async def approve_org(
    org_id: int,
    current_admin: dict = Depends(get_current_admin),
):
    try:
        pool = await get_pool()
    except RuntimeError:
        raise HTTPException(503, "Database unavailable.")

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM organizations WHERE id = $1", org_id
        )
        if not row:
            raise HTTPException(404, "Organization not found.")
        if row["status"] == "APPROVED":
            raise HTTPException(409, "Organization is already approved.")

        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        await conn.execute(
            """
            UPDATE organizations
            SET status = 'APPROVED', approved_at = $1, rejected_at = NULL
            WHERE id = $2
            """,
            now, org_id,
        )

    # Email notification (non-fatal)
    try:
        await email_service.notify_org_approved(
            org_name=row["org_name"],
            org_email=row["email"],
        )
    except Exception:
        pass

    return {
        "success":  True,
        "org_id":   org_id,
        "org_name": row["org_name"],
        "message":  f"Organization '{row['org_name']}' has been approved.",
    }


# ── POST /admin/orgs/{id}/reject ──────────────────────────────────────────────

@router.post("/orgs/{org_id}/reject")
async def reject_org(
    org_id: int,
    current_admin: dict = Depends(get_current_admin),
):
    try:
        pool = await get_pool()
    except RuntimeError:
        raise HTTPException(503, "Database unavailable.")

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM organizations WHERE id = $1", org_id
        )
        if not row:
            raise HTTPException(404, "Organization not found.")
        if row["status"] == "REJECTED":
            raise HTTPException(409, "Organization is already rejected.")

        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        await conn.execute(
            """
            UPDATE organizations
            SET status = 'REJECTED', rejected_at = $1
            WHERE id = $2
            """,
            now, org_id,
        )

    # Email notification (non-fatal)
    try:
        await email_service.notify_org_rejected(
            org_name=row["org_name"],
            org_email=row["email"],
        )
    except Exception:
        pass

    return {
        "success":  True,
        "org_id":   org_id,
        "org_name": row["org_name"],
        "message":  f"Organization '{row['org_name']}' has been rejected.",
    }
