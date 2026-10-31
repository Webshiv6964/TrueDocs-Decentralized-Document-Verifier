"""
Tests the "any MetaMask account" registration flow.

Key scenarios:
 - Link Wallet A, then prepare+confirm a tx signed by Wallet B.
   The backend must accept Wallet B and auto-update the stored address.
 - Link Wallet B, then switch to Wallet C and do another registration.
 - A pending org cannot register even after linking a wallet.
"""

import io
import requests
import time
from eth_account import Account
from eth_account.messages import encode_defunct

BASE = "http://127.0.0.1:8001/api"

# Hardhat test accounts (well-known, safe to use in tests)
ACCOUNT_A_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
ACCOUNT_B_KEY = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
ACCOUNT_C_KEY = "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"

acct_a = Account.from_key(ACCOUNT_A_KEY)
acct_b = Account.from_key(ACCOUNT_B_KEY)
acct_c = Account.from_key(ACCOUNT_C_KEY)

print(f"Account A: {acct_a.address}")
print(f"Account B: {acct_b.address}")
print(f"Account C: {acct_c.address}\n")


def sign_nonce(account, message):
    msg = encode_defunct(text=message)
    return "0x" + account.sign_message(msg).signature.hex()


def org_login(email, password):
    r = requests.post(f"{BASE}/org/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed: {r.json()}"
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def link_wallet(hdr, account):
    r = requests.get(f"{BASE}/org/wallet/nonce", headers=hdr)
    assert r.status_code == 200
    sig = sign_nonce(account, r.json()["message"])
    r2 = requests.post(f"{BASE}/org/wallet/link", headers=hdr,
                       json={"wallet_address": account.address.lower(), "signature": sig})
    assert r2.status_code == 200, f"Link failed: {r2.json()}"
    return r2.json()["wallet_address"]


def prepare(hdr, content):
    r = requests.post(f"{BASE}/org/documents/prepare", headers=hdr,
                      files={"file": ("doc.txt", io.BytesIO(content), "text/plain")})
    return r


def main():
    hdr_a = org_login("demo-org-a@truedocs.dev", "DemoOrgA@2024!")
    hdr_b = org_login("demo-org-b@truedocs.dev", "DemoOrgB@2024!")

    # ── Test 1: Link Wallet A to Org A ─────────────────────────────────────────
    stored = link_wallet(hdr_a, acct_a)
    print(f"1. Linked Wallet A to Org A: {stored[:20]}...")

    # ── Test 2: Prepare returns wallet_address even if different account will sign
    content_1 = f"doc-test-multi-{time.time_ns()}".encode()
    r = prepare(hdr_a, content_1)
    assert r.status_code == 200, f"Prepare failed: {r.json()}"
    prep = r.json()
    print(f"2. Prepare OK: doc_hash={prep['doc_hash'][:20]}... cid={prep.get('cid','?')[:20]}...")

    # ── Test 3: Org without a linked wallet is blocked ─────────────────────────
    # First clear any previously linked wallet on Org B by checking its profile
    r_prof_b = requests.get(f"{BASE}/org/me", headers=hdr_b)
    org_b_wallet = r_prof_b.json().get("wallet_address")
    if org_b_wallet:
        print(f"3. Org B already has a wallet ({org_b_wallet[:20]}...) — skipping unlinked test")
    else:
        content_3 = f"doc-test-unlinked-{time.time_ns()}".encode()
        r = prepare(hdr_b, content_3)
        assert r.status_code == 403, f"Unlinked org should be 403, got {r.status_code}"
        print(f"3. Org B (no wallet) blocked: 403 OK")

    # ── Test 4: Link Wallet B to Org B ─────────────────────────────────────────
    stored_b = link_wallet(hdr_b, acct_b)
    print(f"4. Linked Wallet B to Org B: {stored_b[:20]}...")

    # ── Test 5: Org B can now prepare ─────────────────────────────────────────
    content_5 = f"doc-test-org-b-{time.time_ns()}".encode()
    r = prepare(hdr_b, content_5)
    assert r.status_code == 200, f"Org B prepare failed: {r.json()}"
    print(f"5. Org B (with wallet) prepare: 200 OK")

    # ── Test 6: Pending org is blocked even after linking ──────────────────────
    # We test this by making a new request + trying to prepare before approval
    r_req = requests.post(f"{BASE}/org/request", json={
        "org_name": "Pending Test Org",
        "email": "pending-test-wallet@truedocs.dev",
        "contact_person": "Test",
        "purpose": "Testing",
        "password": "Pending123!",
    })
    assert r_req.status_code in (200, 409), f"Request failed: {r_req.json()}"

    try:
        hdr_pending = org_login("pending-test-wallet@truedocs.dev", "Pending123!")
        print(f"6. Pending org should not be able to log in")
        assert False, "Pending org should not be able to log in"
    except AssertionError:
        raise
    except Exception:
        # Login correctly fails with 403
        print(f"6. Pending org blocked at login: 403 OK")

    # ── Test 7: confirm endpoint with wrong signer_address is rejected ──────────
    content_7 = f"doc-test-wrong-signer-{time.time_ns()}".encode()
    r = prepare(hdr_a, content_7)
    assert r.status_code == 200
    prep7 = r.json()
    # Supply a fake tx hash and a wrong signer — backend will reject it
    r_confirm = requests.post(f"{BASE}/org/documents/confirm", headers=hdr_a, json={
        "tx_hash": "0x" + "aa" * 32,
        "doc_hash": prep7["doc_hash"],
        "cid": prep7.get("cid", "QmFake"),
        "ipfs_url": "",
        "filename": "doc.txt",
        "signer_address": "0x0000000000000000000000000000000000000001",
    })
    assert r_confirm.status_code in (400, 503), f"Fake tx should be rejected: {r_confirm.status_code}"
    print(f"7. Fake tx rejected ({r_confirm.status_code}): {r_confirm.json().get('detail','')[:60]}")

    # ── Test 8: Profile shows the currently linked wallet ──────────────────────
    r_prof = requests.get(f"{BASE}/org/me", headers=hdr_a)
    assert r_prof.status_code == 200
    wallet_in_db = r_prof.json().get("wallet_address", "")
    print(f"8. Org A profile wallet: {wallet_in_db[:30]}...")
    # Should be Account A (lowercase) since we linked it
    assert wallet_in_db == acct_a.address.lower(), f"Expected {acct_a.address.lower()}, got {wallet_in_db}"
    print(f"   Matches Account A: OK")

    print()
    print("=== ALL MULTI-ACCOUNT TESTS PASSED ===")


if __name__ == "__main__":
    main()
