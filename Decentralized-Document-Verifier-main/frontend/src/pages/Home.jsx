import React from "react";
import { Link } from "react-router-dom";

/* ── Flow visualization (SVG-based) ─────────────────────────── */
function FlowDiagram() {
  return (
    <div className="flow-diagram" aria-hidden="true">
      <div className="flow-step">
        <div className="flow-node">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="5" y="2" width="14" height="18" rx="2" stroke="#18C7B0" strokeWidth="1.4" fill="none"/>
            <path d="M14 2v5h5" stroke="#18C7B0" strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
            <path d="M8 11h8M8 14h6" stroke="#18C7B0" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </div>
        <span>Document</span>
      </div>
      <div className="flow-arrow">
        <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
          <path d="M0 6h20M16 2l4 4-4 4" stroke="rgba(24,199,176,0.4)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div className="flow-step">
        <div className="flow-node">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M14 4L4 9v5c0 5.5 4.3 10.7 10 12 5.7-1.3 10-6.5 10-12V9L14 4z" stroke="#18C7B0" strokeWidth="1.4" fill="none"/>
            <path d="M10 14l3 3 6-6" stroke="#18C7B0" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span>Fingerprint</span>
      </div>
      <div className="flow-arrow">
        <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
          <path d="M0 6h20M16 2l4 4-4 4" stroke="rgba(24,199,176,0.4)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div className="flow-step">
        <div className="flow-node">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="3" y="11" width="8" height="8" rx="1.5" stroke="#18C7B0" strokeWidth="1.4" fill="none"/>
            <rect x="11" y="5" width="8" height="8" rx="1.5" stroke="#18C7B0" strokeWidth="1.4" fill="none"/>
            <rect x="17" y="15" width="8" height="8" rx="1.5" stroke="#18C7B0" strokeWidth="1.4" fill="none"/>
            <path d="M7 11V8.5a4.5 4.5 0 014.5-4.5M15 13h2M19 19h-2" stroke="rgba(24,199,176,0.5)" strokeWidth="1" strokeLinecap="round"/>
          </svg>
        </div>
        <span>Blockchain</span>
      </div>
      <div className="flow-arrow">
        <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
          <path d="M0 6h20M16 2l4 4-4 4" stroke="rgba(24,199,176,0.4)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div className="flow-step flow-step--verified">
        <div className="flow-node flow-node--accent">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="10" stroke="#18C7B0" strokeWidth="1.4"/>
            <path d="M9 14l3.5 3.5L19 10" stroke="#18C7B0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span>Verified</span>
      </div>
    </div>
  );
}

/* ── Feature card ────────────────────────────────────────────── */
function FeatureCard({ icon, title, description, delay }) {
  return (
    <div className={`feature-card animate-fade-up anim-delay-${delay}`}>
      <div className="feature-card-icon" aria-hidden="true">{icon}</div>
      <h3 className="feature-card-title">{title}</h3>
      <p className="feature-card-desc">{description}</p>
    </div>
  );
}

/* ── How it works step ───────────────────────────────────────── */
function HowStep({ num, title, desc, delay }) {
  return (
    <div className={`how-step animate-fade-up anim-delay-${delay}`}>
      <div className="how-step-num" aria-hidden="true">{String(num).padStart(2,"0")}</div>
      <h3 className="how-step-title">{title}</h3>
      <p className="how-step-desc">{desc}</p>
    </div>
  );
}

export default function Home() {
  return (
    <div className="page-home">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="hero-section" aria-labelledby="hero-heading">
        {/* Atmospheric glow */}
        <div className="hero-glow" aria-hidden="true" />

        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-eyebrow animate-fade-up">
              <span className="eyebrow-dot" />
              Decentralized Document Verification
            </div>

            <h1 id="hero-heading" className="hero-title animate-fade-up anim-delay-1">
              Prove authenticity.<br />
              <span className="hero-title-accent">Trust the record.</span>
            </h1>

            <p className="hero-subtitle animate-fade-up anim-delay-2">
              TrueDoc stores a cryptographic fingerprint of your documents on the Ethereum
              blockchain via IPFS. Tamper-proof. Permanent. Verifiable by anyone.
            </p>

            <div className="hero-actions animate-fade-up anim-delay-3">
              <Link to="/org/login" className="btn btn-primary btn-xl">
                Register Document
              </Link>
              <Link to="/verify" className="btn btn-outline btn-xl">
                Verify Document
              </Link>
            </div>
          </div>

          {/* Flow diagram */}
          <div className="hero-visual animate-fade-in anim-delay-2">
            <div className="hero-visual-card">
              <div className="hero-visual-label">Verification flow</div>
              <FlowDiagram />
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────── */}
      <section className="section how-section" aria-labelledby="how-heading">
        <div className="container">
          <div className="section-header">
            <p className="section-eyebrow">How it works</p>
            <h2 id="how-heading" className="section-title animate-fade-up">
              Four steps to permanent verification
            </h2>
          </div>

          <div className="how-steps">
            <HowStep num={1} delay={1}
              title="Upload your document"
              desc="Choose any file and assign it a unique Document ID. TrueDoc sends it to IPFS via Pinata."
            />
            <HowStep num={2} delay={2}
              title="CID generated"
              desc="IPFS produces a Content Identifier — a cryptographic fingerprint unique to your exact file."
            />
            <HowStep num={3} delay={3}
              title="Written to blockchain"
              desc="The Document ID and CID are stored in an Ethereum smart contract. Immutable. Forever."
            />
            <HowStep num={4} delay={4}
              title="Verify anytime"
              desc="Anyone with the Document ID and CID can verify authenticity in seconds — no trust required."
            />
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────── */}
      <section className="section features-section" aria-labelledby="features-heading">
        <div className="container">
          <div className="section-header">
            <p className="section-eyebrow">Why TrueDoc</p>
            <h2 id="features-heading" className="section-title animate-fade-up">
              Built on trustless infrastructure
            </h2>
          </div>

          <div className="features-grid">
            <FeatureCard delay={1}
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6L12 2z" stroke="currentColor" strokeWidth="1.6" fill="none"/>
                  <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              }
              title="Tamper-Proof"
              description="Once registered, no one — not even TrueDoc — can alter or delete your blockchain record."
            />
            <FeatureCard delay={2}
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" fill="none"/>
                  <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  <path d="M4.5 4.5l1.5 1.5M17.5 4.5L16 6M12 3V1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              }
              title="Permanent Record"
              description="Your document fingerprint lives on the blockchain indefinitely. Upload once, verify forever."
            />
            <FeatureCard delay={3}
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M4 8h4V4H4v4zM10 8h4V4h-4v4zM16 8h4V4h-4v4zM4 14h4v-4H4v4zM10 14h4v-4h-4v4zM16 14h4v-4h-4v4zM4 20h4v-4H4v4zM10 20h4v-4h-4v4zM16 20h4v-4h-4v4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
                </svg>
              }
              title="Decentralized Storage"
              description="Files are stored on IPFS — a distributed network with no single point of failure or control."
            />
            <FeatureCard delay={4}
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="none"/>
                </svg>
              }
              title="Instant Verification"
              description="Verify any registered document in seconds. No accounts needed — just the ID and CID."
            />
            <FeatureCard delay={5}
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="6" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="1.6" fill="none"/>
                  <path d="M2 10h20M6 14h4M6 17h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  <circle cx="17" cy="15.5" r="2.5" stroke="currentColor" strokeWidth="1.4" fill="none"/>
                  <path d="M19 17.5l1.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              }
              title="Open Verification"
              description="Anyone can verify — no login required. The blockchain is the source of truth."
            />
            <FeatureCard delay={6}
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3 12a9 9 0 1118 0 9 9 0 01-18 0z" stroke="currentColor" strokeWidth="1.6" fill="none"/>
                </svg>
              }
              title="Revocation Support"
              description="Document issuers can revoke records when needed. The revocation is also on-chain."
            />
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section className="cta-section" aria-labelledby="cta-heading">
        <div className="container">
          <div className="cta-card">
            <div className="cta-glow" aria-hidden="true" />
            <h2 id="cta-heading" className="cta-title">
              Start verifying documents today
            </h2>
            <p className="cta-desc">
              Verify any document instantly — no account needed. Organizations can register
              after admin approval.
            </p>
            <div className="cta-actions">
              <Link to="/verify" className="btn btn-primary btn-lg">
                Verify a Document
              </Link>
              <Link to="/org/request" className="btn btn-ghost btn-lg">
                Request Org Access
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
