"""
seed.py
Development seed script for TrueDocs.

Creates:
  1. The single admin account (from env vars or defaults)
  2. Two fictional demo organizations (pre-approved for testing)

Usage:
    cd backend
    venv\Scripts\python.exe seed.py

NEVER run this in production unless you want to reset demo data.
Admin account is created only if it does not already exist — no
password reset on re-run.
"""

import asyncio
import os
import sys

from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db   import init_db, close_db, get_pool
from app.auth import hash_password


ADMIN_EMAIL    = os.getenv("ADMIN_EMAIL",         "admin@truedocs.dev")
ADMIN_PASSWORD = os.getenv("ADMIN_SEED_PASSWORD", "Admin@TrueDocs2024!")

# ── Demo organizations (fictional) ────────────────────────────────────────────
# Passwords come from env vars so they are not hardcoded in source code.
DEMO_ORGS = [
    {
        "org_name":       "Demo Organization A",
        "email":          os.getenv("DEMO_ORG_A_EMAIL",    "demo-org-a@truedocs.dev"),
        "contact_person": "Alice Demo",
        "purpose":        "Development and testing of document verification workflows.",
        "password":       os.getenv("DEMO_ORG_A_PASSWORD", "DemoOrgA@2024!"),
        "status":         "APPROVED",   # pre-approved for testing
    },
    {
        "org_name":       "Demo Organization B",
        "email":          os.getenv("DEMO_ORG_B_EMAIL",    "demo-org-b@truedocs.dev"),
        "contact_person": "Bob Demo",
        "purpose":        "Testing the approval workflow and multi-org document isolation.",
        "password":       os.getenv("DEMO_ORG_B_PASSWORD", "DemoOrgB@2024!"),
        "status":         "APPROVED",   # pre-approved for testing
    },
]


async def seed():
    await init_db()
    pool = await get_pool()

    async with pool.acquire() as conn:
        # ── Admin ──────────────────────────────────────────────────────────────
        existing_admin = await conn.fetchrow(
            "SELECT id FROM admin WHERE email = $1", ADMIN_EMAIL
        )
        if existing_admin:
            print(f"[SEED] Admin already exists: {ADMIN_EMAIL} — skipping.")
        else:
            await conn.execute(
                "INSERT INTO admin (email, password_hash) VALUES ($1, $2)",
                ADMIN_EMAIL,
                hash_password(ADMIN_PASSWORD),
            )
            print(f"[SEED] Admin created: {ADMIN_EMAIL}")

        # ── Demo orgs ──────────────────────────────────────────────────────────
        for org in DEMO_ORGS:
            existing = await conn.fetchrow(
                "SELECT id, status FROM organizations WHERE email = $1", org["email"]
            )
            if existing:
                if existing["status"] != org["status"]:
                    await conn.execute(
                        "UPDATE organizations SET status = $1 WHERE email = $2",
                        org["status"], org["email"],
                    )
                    print(f"[SEED] Updated status for {org['email']} → {org['status']}")
                else:
                    print(f"[SEED] Demo org already exists: {org['email']} — skipping.")
            else:
                from datetime import datetime, timezone
                now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
                await conn.execute(
                    """
                    INSERT INTO organizations
                        (org_name, email, contact_person, purpose,
                         password_hash, status, email_verified, created_at, approved_at)
                    VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8)
                    """,
                    org["org_name"],
                    org["email"],
                    org["contact_person"],
                    org["purpose"],
                    hash_password(org["password"]),
                    org["status"],
                    now,
                    now,
                )
                print(f"[SEED] Demo org created: {org['org_name']} ({org['email']})")

    await close_db()

    print("\n" + "=" * 60)
    print("  TrueDocs Development Seed — Credentials Summary")
    print("=" * 60)
    print(f"\n  ADMIN")
    print(f"    Email:    {ADMIN_EMAIL}")
    print(f"    Password: {ADMIN_PASSWORD}")
    print(f"\n  DEMO ORG A (pre-approved)")
    print(f"    Email:    {DEMO_ORGS[0]['email']}")
    print(f"    Password: {DEMO_ORGS[0]['password']}")
    print(f"\n  DEMO ORG B (pre-approved)")
    print(f"    Email:    {DEMO_ORGS[1]['email']}")
    print(f"    Password: {DEMO_ORGS[1]['password']}")
    print("\n  These are FICTIONAL development accounts.")
    print("  Do NOT use real credentials or real company names.")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    asyncio.run(seed())
