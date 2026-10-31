import React, { useState } from "react";

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <button
      type="button"
      className={`btn-copy${copied ? " copied" : ""}`}
      onClick={copy}
      aria-label="Copy to clipboard"
    >
      {copied ? (
        <>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
            <path d="M1.5 5.5l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
            <rect x="3.5" y="3.5" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M2 7.5V2a1 1 0 011-1h5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

function DetailRow({ label, children, mono = false }) {
  return (
    <div className="detail-row">
      <dt className="detail-label">{label}</dt>
      <dd className={`detail-value${mono ? " detail-value--mono" : ""}`}>{children}</dd>
    </div>
  );
}

/**
 * VerificationResult
 * Props: type ("register"|"verify"), data (API response), onReset (fn)
 */
export default function VerificationResult({ type, data, onReset }) {
  if (!data) return null;

  /* ── Register result ─────────────────────────────────────── */
  if (type === "register") {
    return (
      <div className="result-card result-card--success animate-scale-in" role="status">
        {/* Header */}
        <div className="result-header">
          <div className="result-seal result-seal--success">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <circle cx="16" cy="16" r="15" stroke="#18C7B0" strokeWidth="1.5" strokeDasharray="94.2" strokeDashoffset="0" style={{animation:"drawRing 0.7s ease-out 0.1s both"}}/>
              <path d="M9 16l5 5 9-9" stroke="#18C7B0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{animation:"fadeIn 0.3s ease-out 0.7s both"}}/>
            </svg>
          </div>
          <div className="result-header-text">
            <div className="result-eyebrow">Registration complete</div>
            <h2 className="result-title">Document Registered</h2>
          </div>
          <span className="badge badge--valid"><span className="badge-dot" />Active</span>
        </div>

        {/* Details */}
        <dl className="result-details">
          <DetailRow label="Document ID">{data.document_id}</DetailRow>

          <DetailRow label="IPFS CID" mono>
            <div className="hash-display">
              <span className="hash-text">{data.cid}</span>
              <CopyButton text={data.cid} />
            </div>
          </DetailRow>

          <DetailRow label="Status">
            <span className="badge badge--valid"><span className="badge-dot" />Valid</span>
          </DetailRow>

          {data.tx_hash && (
            <DetailRow label="Tx Hash" mono>
              <div className="hash-display">
                <span className="hash-text">{data.tx_hash}</span>
                <CopyButton text={data.tx_hash} />
              </div>
            </DetailRow>
          )}

          {data.ipfs_url && (
            <DetailRow label="IPFS Link">
              <a href={data.ipfs_url} target="_blank" rel="noopener noreferrer" className="result-link">
                View on IPFS Gateway
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ display:"inline-block", marginLeft: 4, verticalAlign: "middle" }}>
                  <path d="M2 2h8M10 2v8M2 10l8-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </a>
            </DetailRow>
          )}
        </dl>

        <div className="result-note">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="6.25" stroke="#45DEC9" strokeWidth="1.25"/>
            <path d="M7 6v4M7 4.5h.01" stroke="#45DEC9" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          Save your CID — you will need it to verify this document later.
        </div>

        <button className="btn btn-secondary" onClick={onReset}>
          Register Another Document
        </button>
      </div>
    );
  }

  /* ── Verify result ───────────────────────────────────────── */
  const isValid = data.verified === true;

  return (
    <div
      className={`result-card ${isValid ? "result-card--success" : "result-card--failure"} animate-scale-in`}
      role="status"
    >
      <div className="result-header">
        <div className={`result-seal ${isValid ? "result-seal--success" : "result-seal--failure"}`}>
          {isValid ? (
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <circle cx="16" cy="16" r="15" stroke="#18C7B0" strokeWidth="1.5"/>
              <path d="M9 16l5 5 9-9" stroke="#18C7B0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <circle cx="16" cy="16" r="15" stroke="#EF5B68" strokeWidth="1.5"/>
              <path d="M10 10l12 12M22 10L10 22" stroke="#EF5B68" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          )}
        </div>
        <div className="result-header-text">
          <div className="result-eyebrow">{isValid ? "Verification successful" : "Verification failed"}</div>
          <h2 className="result-title">
            {isValid ? "Document Verified" : "Could Not Verify"}
          </h2>
        </div>
        <span className={`badge ${isValid ? "badge--valid" : "badge--invalid"}`}>
          <span className="badge-dot" />{data.status}
        </span>
      </div>

      <p className="result-message">{data.message}</p>

      {data.source && (
        <dl className="result-details">
          <DetailRow label="Verified Via">
            {data.source === "database" ? "Database cache" : "Blockchain smart contract"}
          </DetailRow>
        </dl>
      )}

      <button className="btn btn-secondary" onClick={onReset}>
        Verify Another Document
      </button>
    </div>
  );
}
