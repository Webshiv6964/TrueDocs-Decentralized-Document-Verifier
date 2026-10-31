import React, { useState } from "react";
import UploadForm from "../components/UploadForm";
import VerificationResult from "../components/VerificationResult";
import { registerDocument } from "../services/api";

/* Verification progress steps */
const STEPS = [
  { id: 1, label: "Reading document" },
  { id: 2, label: "Uploading to IPFS" },
  { id: 3, label: "Writing to blockchain" },
  { id: 4, label: "Confirming record" },
];

function RegisterProgress({ step }) {
  return (
    <div className="reg-progress" role="status" aria-live="polite" aria-label="Registration in progress">
      <div className="reg-progress-header">
        <div className="spinner spinner-lg" aria-hidden="true" style={{ color: "var(--color-brand-400)" }} />
        <div>
          <div className="reg-progress-title">Registering document…</div>
          <div className="reg-progress-sub">This may take up to 30 seconds</div>
        </div>
      </div>
      <div className="reg-progress-steps">
        {STEPS.map((s, i) => {
          const state = step > s.id ? "done" : step === s.id ? "active" : "pending";
          return (
            <div key={s.id} className={`reg-step reg-step--${state}`}>
              <div className="reg-step-indicator">
                {state === "done" ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M2.5 7l3 3 6-6" stroke="#10B981" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : state === "active" ? (
                  <span className="reg-step-dot reg-step-dot--active" />
                ) : (
                  <span className="reg-step-dot" />
                )}
              </div>
              <span className="reg-step-label">{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Register() {
  const [loading,  setLoading]  = useState(false);
  const [step,     setStep]     = useState(1);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState("");

  async function handleSubmit(documentId, file) {
    setLoading(true);
    setError("");
    setResult(null);
    setStep(1);

    // Simulate step progression while waiting
    const t1 = setTimeout(() => setStep(2), 1000);
    const t2 = setTimeout(() => setStep(3), 4000);
    const t3 = setTimeout(() => setStep(4), 8000);

    try {
      const data = await registerDocument(documentId, file);
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      setResult(data);
    } catch (err) {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
      setStep(1);
    }
  }

  function handleReset() {
    setResult(null);
    setError("");
  }

  return (
    <div className="page-padded">
      <div className="container">
        <div className="page-layout-split">

          {/* Left — info */}
          <aside className="page-aside animate-fade-up">
            <div className="page-eyebrow">Registration</div>
            <h1 className="page-title">Register a Document</h1>
            <p className="page-description">
              Upload any file to IPFS and record its cryptographic fingerprint permanently on the Ethereum blockchain.
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
                  <div className="aside-step-title">Upload to IPFS</div>
                  <div className="aside-step-desc">File is pinned via Pinata and a CID is generated</div>
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
                  <div className="aside-step-title">On-chain record</div>
                  <div className="aside-step-desc">CID is written to the smart contract</div>
                </div>
              </div>
              <div className="aside-step">
                <div className="aside-step-icon">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M9 2L3 5.5v4c0 3.5 2.5 6.8 6 7.5 3.5-.7 6-4 6-7.5v-4L9 2z" stroke="currentColor" strokeWidth="1.4" fill="none"/>
                    <path d="M6 9l2.5 2.5L12 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <div className="aside-step-title">Permanent proof</div>
                  <div className="aside-step-desc">Anyone can verify with the Document ID + CID</div>
                </div>
              </div>
            </div>
          </aside>

          {/* Right — form / state */}
          <div className="page-main animate-fade-up anim-delay-1">
            {error && (
              <div className="alert alert--error" role="alert">
                <div className="alert-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M8 5v3.5M8 10.5h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="alert-body">{error}</div>
                <button className="alert-close" onClick={() => setError("")} aria-label="Dismiss">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                </button>
              </div>
            )}

            {loading ? (
              <div className="card">
                <RegisterProgress step={step} />
              </div>
            ) : result ? (
              <VerificationResult type="register" data={result} onReset={handleReset} />
            ) : (
              <div className="card">
                <UploadForm onSubmit={handleSubmit} loading={loading} />
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
