import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { orgLogin } from "../services/api";

export default function OrgLogin() {
  const navigate = useNavigate();
  const { loginOrg, isOrgLoggedIn } = useAuth();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  // Already logged in — redirect
  if (isOrgLoggedIn) {
    navigate("/org/dashboard", { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true); setError("");
    try {
      const data = await orgLogin(email.trim(), password);
      loginOrg(data);
      navigate("/org/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-padded">
      <div className="container" style={{ maxWidth: 440, marginInline:"auto" }}>
        <div className="page-header" style={{ textAlign:"center" }}>
          <div className="page-eyebrow">Organization</div>
          <h1 className="page-title" style={{ fontSize:"var(--text-3xl)" }}>Welcome back</h1>
          <p style={{ color:"var(--dark-text-secondary)", fontSize:"var(--text-sm)" }}>
            Sign in to your organization account
          </p>
        </div>

        {error && (
          <div className="alert alert--error" role="alert">
            <div className="alert-body">{error}</div>
            <button className="alert-close" onClick={() => setError("")}>✕</button>
          </div>
        )}

        <div className="card">
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="org-email" className="form-label">Email address</label>
              <input
                id="org-email" type="email" className="form-input"
                placeholder="org@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                disabled={loading} required autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="org-password" className="form-label">Password</label>
              <input
                id="org-password" type="password" className="form-input"
                placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)}
                disabled={loading} required autoComplete="current-password"
              />
            </div>

            <button
              type="submit" className="btn btn-primary btn-lg"
              disabled={loading || !email.trim() || !password}
              style={{ width:"100%" }}
            >
              {loading ? <><span className="spinner" aria-hidden="true"/> Signing in…</> : "Sign In"}
            </button>
          </form>
        </div>

        <p style={{ textAlign:"center", marginTop:"var(--space-6)", fontSize:"var(--text-sm)", color:"var(--dark-text-secondary)" }}>
          Don't have an account?{" "}
          <Link to="/org/request" style={{ color:"var(--color-brand-400)", fontWeight:600 }}>
            Request access
          </Link>
        </p>
        <p style={{ textAlign:"center", marginTop:"var(--space-3)", fontSize:"var(--text-xs)", color:"var(--dark-text-tertiary)" }}>
          Admin?{" "}
          <Link to="/admin/login" style={{ color:"var(--dark-text-secondary)" }}>
            Admin login →
          </Link>
        </p>
      </div>
    </div>
  );
}
