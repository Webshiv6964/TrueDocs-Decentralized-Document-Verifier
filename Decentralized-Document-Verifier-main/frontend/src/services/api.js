/**
 * api.js — TrueDocs v2
 * All HTTP calls to the FastAPI backend.
 * Vite dev proxy forwards /api → http://localhost:8000
 */

import axios from "axios";

const client = axios.create({
  baseURL: "/api",
  timeout: 60_000,
});

// ── Auth token injection ──────────────────────────────────────────────────────
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("truedocs_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Error normalisation ───────────────────────────────────────────────────────
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const detail = error.response.data?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
          ? detail.map((d) => d.msg).join(", ")
          : `Request failed with status ${error.response.status}`;
      const err = new Error(message);
      err.status = error.response.status;
      return Promise.reject(err);
    }
    if (error.request) {
      return Promise.reject(
        new Error("Cannot reach the backend. Make sure it is running on port 8000.")
      );
    }
    return Promise.reject(error);
  }
);

// ══════════════════════════════════════════════════════════════
//  PUBLIC — no auth required
// ══════════════════════════════════════════════════════════════

/** Verify a document by uploading the file (hash-based, no ID needed) */
export async function publicVerifyDocument(file) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await client.post("/public/verify", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

/** Look up a document record by its SHA-256 hash */
export async function publicGetDocument(docHash) {
  const { data } = await client.get(`/public/document/${encodeURIComponent(docHash)}`);
  return data;
}

// ══════════════════════════════════════════════════════════════
//  ORGANIZATION AUTH
// ══════════════════════════════════════════════════════════════

/** Submit an access request */
export async function orgRequest(body) {
  const { data } = await client.post("/org/request", body);
  return data;
}

/** Log in as an organization */
export async function orgLogin(email, password) {
  const { data } = await client.post("/org/login", { email, password });
  return data; // { access_token, org_name, email, org_id }
}

/** Get current org profile */
export async function orgMe() {
  const { data } = await client.get("/org/me");
  return data;
}

/** List this org's documents */
export async function orgDocuments() {
  const { data } = await client.get("/org/documents");
  return data;
}

/** Register a document (approved org only) — legacy backend-signed flow */
export async function orgRegisterDocument(file) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await client.post("/org/documents/register", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

// ── Wallet linking (MetaMask) ──────────────────────────────────────────────────

/** Get a nonce for wallet signing */
export async function getWalletNonce() {
  const { data } = await client.get("/org/wallet/nonce");
  return data; // { nonce, message }
}

/** Verify signature and link wallet to org account */
export async function linkWallet(walletAddress, signature) {
  const { data } = await client.post("/org/wallet/link", {
    wallet_address: walletAddress,
    signature:      signature,
  });
  return data;
}

// ── MetaMask-based registration (prepare + confirm) ──────────────────────────

/** Phase 1: Upload to IPFS, get CID + doc hash (no blockchain tx yet) */
export async function prepareDocument(file) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await client.post("/org/documents/prepare", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

/** Phase 2: Verify on-chain tx and store in DB */
export async function confirmDocument(txHash, docHash, cid, ipfsUrl, filename, signerAddress) {
  const { data } = await client.post("/org/documents/confirm", {
    tx_hash:        txHash,
    doc_hash:       docHash,
    cid:            cid,
    ipfs_url:       ipfsUrl || "",
    filename:       filename || "",
    signer_address: signerAddress || "",
  });
  return data;
}

// ══════════════════════════════════════════════════════════════
//  ADMIN AUTH
// ══════════════════════════════════════════════════════════════

/** Log in as admin */
export async function adminLogin(email, password) {
  const { data } = await client.post("/admin/login", { email, password });
  return data;
}

/** List all organizations */
export async function adminListOrgs() {
  const { data } = await client.get("/admin/orgs");
  return data;
}

/** Approve an organization */
export async function adminApproveOrg(orgId) {
  const { data } = await client.post(`/admin/orgs/${orgId}/approve`);
  return data;
}

/** Reject an organization */
export async function adminRejectOrg(orgId) {
  const { data } = await client.post(`/admin/orgs/${orgId}/reject`);
  return data;
}

// ══════════════════════════════════════════════════════════════
//  LEGACY (kept for backward compatibility)
// ══════════════════════════════════════════════════════════════

export async function registerDocument(documentId, file) {
  const formData = new FormData();
  formData.append("document_id", documentId);
  formData.append("file", file);
  const { data } = await client.post("/documents/register", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function verifyDocument(documentId, cid) {
  const { data } = await client.post("/documents/verify", { document_id: documentId, cid });
  return data;
}

export async function getDocument(documentId) {
  const { data } = await client.get(`/documents/${encodeURIComponent(documentId)}`);
  return data;
}

export async function revokeDocument(documentId) {
  const { data } = await client.post("/documents/revoke", { document_id: documentId });
  return data;
}
