import React, { useState, useRef, useCallback } from "react";
import { publicVerifyDocument } from "../services/api";

const MAX_SIZE = 20 * 1024 * 1024;

function formatBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b/1024).toFixed(1)} KB`;
  return `${(b/(1024*1024)).toFixed(2)} MB`;
}

function ResultCard({ result, onReset }) {
  const statusMap = {
    verified:  { color: "var(--color-success-500)", icon: "✓", label: "Verified",     cardClass: "result-card--success" },
    invalid:   { color: "var(--color-error-500)",   icon: "✗", label: "Invalid",      cardClass: "result-card--failure" },
    not_found: { color: "var(--color-warning-500)", icon: "?", label: "Not Found",    cardClass: "result-card--warning" },
    error:     { color: "var(--color-error-500)",   icon: "!", label: "Error",         cardClass: "result-card--failure" },
  };
  const s = statusMap[result.result] || statusMap.error;

  return (
    <div className={`result-card ${s.cardClass} animate-scale-in`} role="status">
      <div className="result-header">
        <div className={`result-seal ${result.result === "verified" ? "result-seal--success" : "result-seal--failure"}`}
             style={{ fontSize: 20, fontWeight: 700, color: s.color, display:"flex", alignItems:"center", justifyContent:"center", width:48, height:48, borderRadius:"50%", border:`2px solid ${s.color}` }}>
          {s.icon}
        </div>
        <div className="result-header-text">
          <div className="result-eyebrow">Document Verification</div>
          <h2 className="result-title">{s.label}</h2>
        </div>
        <span className="badge" style={{ background: `${s.color}22`, color: s.color, border: `1px solid ${s.color}44` }}>
          <span className="badge-dot" style={{ background: s.color }} />
          {result.status || result.result?.toUpperCase()}
        </span>
      </div>

      <p className="result-message" style={{ margin: "var(--space-4) 0" }}>{result.message}</p>

      {result.result === "verified" && (
        <dl className="result-details">
          {result.registered_by && (
            <div className="detail-row">
              <dt className="detail-label">Registered by</dt>
              <dd className="detail-value">{result.registered_by}</dd>
            </div>
          )}
          {result.registered_at && (
            <div className="detail-row">
              <dt className="detail-label">Registered on</dt>
              <dd className="detail-value">{new Date(result.registered_at).toLocaleString()}</dd>
            </div>
          )}
          {result.filename && (
            <div className="detail-row">
              <dt className="detail-label">Filename</dt>
              <dd className="detail-value">{result.filename}</dd>
            </div>
          )}
          {result.cid && (
            <div className="detail-row">
              <dt className="detail-label">IPFS CID</dt>
              <dd className="detail-value detail-value--mono" style={{ fontFamily:"var(--font-mono)", fontSize:"var(--text-xs)", wordBreak:"break-all" }}>
                {result.cid}
                {result.ipfs_url && (
                  <a href={result.ipfs_url} target="_blank" rel="noopener noreferrer" className="result-link" style={{ marginLeft:8 }}>
                    View ↗
                  </a>
                )}
              </dd>
            </div>
          )}
          {result.doc_hash && (
            <div className="detail-row">
              <dt className="detail-label">SHA-256</dt>
              <dd className="detail-value detail-value--mono" style={{ fontFamily:"var(--font-mono)", fontSize:"var(--text-xs)", wordBreak:"break-all" }}>
                {result.doc_hash}
              </dd>
            </div>
          )}
        </dl>
      )}

      <button className="btn btn-secondary" onClick={onReset} style={{ marginTop: "var(--space-6)" }}>
        Verify Another Document
      </button>
    </div>
  );
}

export default function PublicVerify() {
  const [file,      setFile]    = useState(null);
  const [dragging,  setDragging] = useState(false);
  const [fileError, setFileErr] = useState("");
  const [loading,   setLoading] = useState(false);
  const [result,    setResult]  = useState(null);
  const [error,     setError]   = useState("");
  const inputRef = useRef(null);

  const acceptFile = useCallback((f) => {
    setFileErr("");
    if (!f) return;
    if (f.size > MAX_SIZE) { setFileErr("File must be under 20 MB."); return; }
    setFile(f);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    acceptFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) { setFileErr("Please select a document."); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const data = await publicVerifyDocument(file);
      setResult(data);
    } catch (err) {
      setError(err.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null); setResult(null); setError(""); setFileErr("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="page-padded">
      <div className="container">
        <div className="page-layout-split">

          {/* Left — info */}
          <aside className="page-aside animate-fade-up">
            <div className="page-eyebrow">Public Verification</div>
            <h1 className="page-title">Verify a Document</h1>
            <p className="page-description">
              Upload any document to instantly verify its authenticity against the blockchain registry.
              No account or login required.
            </p>

            <div className="aside-steps">
              <div className="aside-step">
                <div className="aside-step-icon">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M9 2v8M5 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 13h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <div className="aside-step-title">Upload your document</div>
                  <div className="aside-step-desc">Drop the exact file you want to verify</div>
                </div>
              </div>
              <div className="aside-step">
                <div className="aside-step-icon">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M9 1L2 5v6c0 4 3 7.5 7 8.5 4-1 7-4.5 7-8.5V5L9 1z" stroke="currentColor" strokeWidth="1.4" fill="none"/>
                    <path d="M5 9l3 3 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <div className="aside-step-title">Hash is computed</div>
                  <div className="aside-step-desc">SHA-256 fingerprint is calculated client-side on the backend</div>
                </div>
              </div>
              <div className="aside-step">
                <div className="aside-step-icon">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <rect x="2" y="7" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" fill="none"/>
                    <rect x="7" y="3" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" fill="none"/>
                    <rect x="11" y="10" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" fill="none"/>
                  </svg>
                </div>
                <div>
                  <div className="aside-step-title">Checked on blockchain</div>
                  <div className="aside-step-desc">Hash is looked up against the smart contract registry</div>
                </div>
              </div>
            </div>
          </aside>

          {/* Right — form / result */}
          <div className="page-main animate-fade-up anim-delay-1">
            {error && (
              <div className="alert alert--error" role="alert" style={{ marginBottom: "var(--space-4)" }}>
                <div className="alert-icon">⚠</div>
                <div className="alert-body">{error}</div>
                <button className="alert-close" onClick={() => setError("")}>✕</button>
              </div>
            )}

            {result ? (
              <ResultCard result={result} onReset={handleReset} />
            ) : (
              <div className="card">
                <h2 style={{ fontSize:"var(--text-xl)", fontWeight:600, marginBottom:"var(--space-2)" }}>
                  Upload Document to Verify
                </h2>
                <p style={{ color:"var(--dark-text-secondary)", fontSize:"var(--text-sm)", marginBottom:"var(--space-6)" }}>
                  We'll compute its SHA-256 hash and check the blockchain. No ID or CID needed.
                </p>

                <form onSubmit={handleSubmit} noValidate>
                  <div className="form-group">
                    <div
                      className={`drop-zone${dragging ? " drop-zone--active" : ""}${file ? " drop-zone--filled" : ""}`}
                      onDrop={handleDrop}
                      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                      onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
                      onClick={() => !file && inputRef.current?.click()}
                      role="button"
                      tabIndex={file ? -1 : 0}
                      aria-label="Drop document here or click to browse"
                      onKeyDown={(e) => { if ((e.key==="Enter"||e.key===" ") && !file) inputRef.current?.click(); }}
                    >
                      <input
                        ref={inputRef}
                        type="file"
                        className="drop-zone-input"
                        onChange={(e) => acceptFile(e.target.files[0])}
                        disabled={loading}
                        aria-hidden="true"
                        tabIndex={-1}
                      />
                      {!file ? (
                        <div className="drop-zone-empty">
                          <div className="drop-zone-icon">
                            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                              <rect width="40" height="40" rx="12" fill="rgba(24,199,176,0.08)"/>
                              <path d="M20 26V14M14 20l6-6 6 6" stroke="#18C7B0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M13 30h14" stroke="#18C7B0" strokeWidth="1.8" strokeLinecap="round"/>
                            </svg>
                          </div>
                          <div className="drop-zone-label">
                            <span className="drop-zone-primary">Drop your document here</span>
                            <span className="drop-zone-secondary">or <span className="drop-zone-browse">click to browse</span></span>
                          </div>
                          <p className="drop-zone-meta">Any file type · Max 20 MB</p>
                        </div>
                      ) : (
                        <div className="drop-zone-preview">
                          <div style={{ fontSize:32 }}>📄</div>
                          <div className="drop-zone-fileinfo">
                            <span className="drop-zone-filename">{file.name}</span>
                            <span className="drop-zone-filesize">{formatBytes(file.size)}</span>
                          </div>
                          <button type="button" className="drop-zone-remove" onClick={(e) => { e.stopPropagation(); handleReset(); }} aria-label="Remove">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                          </button>
                        </div>
                      )}
                    </div>
                    {fileError && <p className="form-error" role="alert">{fileError}</p>}
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-lg"
                    disabled={loading || !file}
                    style={{ width: "100%" }}
                  >
                    {loading ? (
                      <><span className="spinner" aria-hidden="true"/> Verifying…</>
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
        </div>
      </div>
    </div>
  );
}
