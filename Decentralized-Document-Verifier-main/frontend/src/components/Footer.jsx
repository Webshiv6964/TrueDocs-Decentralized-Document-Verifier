import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="navbar-logo" style={{ width: 24, height: 24 }}>
            <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ width: 12, height: 12 }}>
              <path d="M3 2h7l3 3v9H3V2z" stroke="white" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
              <path d="M10 2v3h3" stroke="white" strokeWidth="1.4" strokeLinejoin="round" />
              <path d="M6 8h4M6 11h2.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
          <span>TrueDocs</span>
        </div>

        <p className="footer-copy">
          Decentralized document verification · Powered by IPFS &amp; Ethereum
        </p>

        <ul className="footer-links">
          <li><Link to="/">Home</Link></li>
          <li><Link to="/verify">Verify</Link></li>
          <li><Link to="/org/request">Request Access</Link></li>
          <li><Link to="/org/login">Org Login</Link></li>
          <li><Link to="/admin/login">Admin</Link></li>
        </ul>
      </div>
    </footer>
  );
}
