import React, { useState } from "react";
import VerificationResult from "../components/VerificationResult";
import { verifyDocument, getDocument, revokeDocument } from "../services/api";

function TabButton({ active, onClick, children }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      className={`verify-tab${active ? " verify-tab--active" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };
  return (
    <button type="button" className={`btn-copy${copied ? " copied" : ""}`} onClick={copy} aria-label="Copy">
      {copied ? "Copied" : (
        <><svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true"><rect x="3.5" y="3.5" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.2"/><path d="M2 7.5V2a1 1 0 011-1h5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> Copy</>
      )}
    </button>
  );
}

export default function Verify() {
  const [tab, setTab] = useState("verify"); // "verify" | "lookup" | "revoke"

  /* ── Verify state ─────────────────────────────────────── */
  const [documentId, setDocumentId] = useState("");
  const [cid,        setCid]        = useState("");
  const [loading,    setLoading]    = useState(false);
  const [result,     setResult]     = useState(null);
  const [error,      setError]      = useState("");

  /* ── Lookup state ─────────────────────────────────────── */
  const [lookupId,      setLookupId]      = useState("");
  const [lookupResult,  setLookupResult]  = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError,   setLookupError]   = useState("");

  /* ── Revoke state ─────────────────────────────────────── */
  const [revokeId,      setRevokeId]      = useState("");
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeMsg,     setRevokeMsg]     = useState("");
  const [revokeError,   setRevokeError]   = useState("");

  /* ── Handlers ─────────────────────────────────────────── */
  async function handleVerify(e) {
    e.preventDefault();
    if (!documentId.trim() || !cid.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const data = await verifyDocument(documentId.trim(), cid.trim());
      setResult(data);
    } catch (err) {
      setError(err.message || "Verification failed. Please try again.");
    } finally { setLoading(false); }
  }

  function handleReset() { setResult(null); setError(""); setDocumentId(""); setCid(""); }

  async function handleLookup(e) {
    e.preventDefault();
    if (!lookupId.trim()) return;
    setLookupLoading(true); setLookupError(""); setLookupResult(null);
    try {
      const data = await getDocument(lookupId.trim());
      setLookupResult(data);
    } catch (err) {
      setLookupError(err.message || "Document not found.");
    } finally { setLookupLoading(false); }
  }

  async function handleRevoke(e) {
    e.preventDefault();
    if (!revokeId.trim()) return;
    if (!window.confirm(`Revoke document "${revokeId}"? This action cannot be undone.`)) return;
    setRevokeLoading(true); setRevokeError(""); setRevokeMsg("");
    try {
      const data = await revokeDocument(revokeId.trim());
      setRevokeMsg(data.message || "Document revoked successfully.");
    } catch (err) {
      setRevokeError(err.message || "Revocation failed.");
    } finally { setRevokeLoading(false); }
  }

  return (
    <div className="page-padded">
      <div className="container">

        {/* Page header */}
        <div className="page-header">
          <p className="page-eyebrow">Verification</p>
          <h1 className="page-title animate-fade-up">Document Operations</h1>
          <p className="page-description animate-fade-up anim-delay-1">
            Verify authenticity, look up document details, or revoke a registered document.
          </p>
        </div>

        {/* Tabs */}
        <div className="verify-tabs" role="tablist" aria-label="Verification operations">
          <TabButton active={tab === "verify"} onClick={() => setTab("verify")}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 7l3.5 3.5L12 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Verify
          </TabButton>
          <TabButton active={tab === "lookup"} onClick={() => setTab("lookup")}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="4.25" stroke="currentColor" strokeWidth="1.4"/><path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            Look Up
          </TabButton>
          <TabButton active={tab === "revoke"} onClick={() => setTab("revoke")}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            Revoke
          </TabButton>
        </div>

        {/* ── Verify tab ────────────────────────────────────── */}
        {tab === "verify" && (
          <div className="verify-panel animate-fade-in" role="tabpanel">
            {error && (
              <div className="alert alert--error" role="alert">
                <div className="alert-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/><path d="M8 5v3.5M8 10.5h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                </div>
                <div className="alert-body">{error}</div>
                <button className="alert-close" onClick={() => setError("")} aria-label="Dismiss">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                </button>
              </div>
            )}

            {result ? (
              <VerificationResult type="verify" data={result} onReset={handleReset} />
            ) : (
              <div className="card">
                <form onSubmit={handleVerify} noValidate>
                  <div className="form-group">
                    <label htmlFor="verify-doc-id" className="form-label">Document ID</label>
                    <input
                      id="verify-doc-id"
                      type="text"
                      className="form-input"
                      placeholder="e.g. CERT-2024-001"
                      value={documentId}
                      onChange={(e) => setDocumentId(e.target.value)}
                      disabled={loading}
                      required
                      autoComplete="off"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="verify-cid" className="form-label">IPFS CID</label>
                    <input
                      id="verify-cid"
                      type="text"
                      className="form-input"
                      placeholder="e.g. bafybeig..."
                      value={cid}
                      onChange={(e) => setCid(e.target.value)}
                      disabled={loading}
                      required
                      autoComplete="off"
                      style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" }}
                    />
                    <p className="form-hint">The CID was shown when you registered the document.</p>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-lg"
                    disabled={loading || !documentId.trim() || !cid.trim()}
                    style={{ width: "100%" }}
                  >
                    {loading ? (
                      <><span className="spinner" aria-hidden="true" /> Verifying on blockchain…</>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path d="M2 8l4 4 8-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Verify Document
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ── Lookup tab ────────────────────────────────────── */}
        {tab === "lookup" && (
          <div className="verify-panel animate-fade-in" role="tabpanel">
            <div className="card">
              <h2 className="verify-panel-title">Look Up Document</h2>
              <p className="verify-panel-desc">Retrieve full on-chain details for any registered document.</p>

              <form onSubmit={handleLookup} noValidate>
                <div className="form-group form-inline">
                  <label htmlFor="lookup-id" className="sr-only">Document ID</label>
                  <input
                    id="lookup-id"
                    type="text"
                    className="form-input"
                    placeholder="Document ID"
                    value={lookupId}
                    onChange={(e) => setLookupId(e.target.value)}
                    disabled={lookupLoading}
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    className="btn btn-secondary"
                    disabled={lookupLoading || !lookupId.trim()}
                  >
                    {lookupLoading ? <><span className="spinner spinner-sm" aria-hidden="true" /> Looking up…</> : "Look Up"}
                  </button>
                </div>
              </form>

              {lookupError && (
                <p className="form-error" role="alert">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="5.25" stroke="#EF5B68" strokeWidth="1.5"/><path d="M6 3.5V6.5M6 8.5h.01" stroke="#EF5B68" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  {lookupError}
                </p>
              )}
            </div>

            {lookupResult && (
              <div className="card card-raised lookup-result animate-fade-up">
                <div className="lookup-header">
                  <h3 className="lookup-doc-id">{lookupResult.document?.documentId}</h3>
                  <span className={`badge ${lookupResult.document?.valid ? "badge--valid" : "badge--invalid"}`}>
                    <span className="badge-dot" />{lookupResult.document?.valid ? "Valid" : "Revoked"}
                  </span>
                </div>

                <dl className="lookup-details">
                  <div className="lookup-row">
                    <dt>IPFS CID</dt>
                    <dd>
                      <div className="hash-display">
                        <span className="hash-text">{lookupResult.document?.cid}</span>
                        <CopyButton text={lookupResult.document?.cid} />
                      </div>
                    </dd>
                  </div>
                  <div className="lookup-row">
                    <dt>Issuer</dt>
                    <dd>
                      <div className="hash-display">
                        <span className="hash-text">{lookupResult.document?.issuer}</span>
                        <CopyButton text={lookupResult.document?.issuer} />
                      </div>
                    </dd>
                  </div>
                  <div className="lookup-row">
                    <dt>Registered</dt>
                    <dd>{new Date((lookupResult.document?.timestamp || 0) * 1000).toLocaleString()}</dd>
                  </div>
                  <div className="lookup-row">
                    <dt>Source</dt>
                    <dd style={{ color: "var(--dark-text-tertiary)", fontSize: "var(--text-sm)" }}>
                      {lookupResult.source === "database" ? "Database cache" : "Blockchain"}
                    </dd>
                  </div>
                  {lookupResult.ipfs_url && (
                    <div className="lookup-row">
                      <dt>IPFS Link</dt>
                      <dd>
                        <a href={lookupResult.ipfs_url} target="_blank" rel="noopener noreferrer" className="result-link">
                          View on IPFS
                          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true" style={{ display:"inline-block", marginLeft:3, verticalAlign:"middle" }}><path d="M2 2h7M9 2v7M2 9l7-7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </div>
        )}

        {/* ── Revoke tab ────────────────────────────────────── */}
        {tab === "revoke" && (
          <div className="verify-panel animate-fade-in" role="tabpanel">
            <div className="card">
              <div className="revoke-warning">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M10 2L1 18h18L10 2z" stroke="#F4B740" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
                  <path d="M10 8v4M10 14.5h.01" stroke="#F4B740" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <div>
                  <strong>Irreversible action</strong>
                  <p>Revoking a document permanently invalidates it on the blockchain. Only the original issuer or contract owner can revoke.</p>
                </div>
              </div>

              <h2 className="verify-panel-title">Revoke Document</h2>

              <form onSubmit={handleRevoke} noValidate>
                <div className="form-group form-inline">
                  <label htmlFor="revoke-id" className="sr-only">Document ID</label>
                  <input
                    id="revoke-id"
                    type="text"
                    className="form-input"
                    placeholder="Document ID to revoke"
                    value={revokeId}
                    onChange={(e) => setRevokeId(e.target.value)}
                    disabled={revokeLoading}
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    className="btn btn-danger"
                    disabled={revokeLoading || !revokeId.trim()}
                  >
                    {revokeLoading ? <><span className="spinner spinner-sm" aria-hidden="true" /> Revoking…</> : "Revoke"}
                  </button>
                </div>
              </form>

              {revokeError && (
                <p className="form-error" role="alert">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="5.25" stroke="#EF5B68" strokeWidth="1.5"/><path d="M6 3.5V6.5M6 8.5h.01" stroke="#EF5B68" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  {revokeError}
                </p>
              )}
              {revokeMsg && (
                <div className="alert alert--success" role="status">
                  <div className="alert-icon">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/><path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <div className="alert-body">{revokeMsg}</div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
