import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { adminLogin } from "../services/api";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { loginAdmin, isAdminLoggedIn } = useAuth();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  if (isAdminLoggedIn) {
    navigate("/admin/dashboard", { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const data = await adminLogin(email.trim(), password);
      loginAdmin(data);
      navigate("/admin/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-padded">
      <div className="container" style={{ maxWidth: 420, marginInline:"auto" }}>
        <div className="page-header" style={{ textAlign:"center" }}>
          <div className="page-eyebrow" style={{ color:"var(--color-warning-500)" }}>Administrator</div>
          <h1 className="page-title" style={{ fontSize:"var(--text-3xl)" }}>Admin Login</h1>
          <p style={{ color:"var(--dark-text-secondary)", fontSize:"var(--text-sm)" }}>
            Restricted to the configured admin account only.
          </p>
        </div>

        <div className="alert alert--warning" style={{ marginBottom:"var(--space-4)" }}>
          <div className="alert-body" style={{ fontSize:"var(--text-xs)" }}>
            This page is for the TrueDocs system administrator only. Organizations should use the
            <a href="/org/login" style={{ color:"var(--color-brand-400)", marginLeft:4 }}>organization login</a>.
          </div>
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
              <label htmlFor="admin-email" className="form-label">Admin Email</label>
              <input id="admin-email" type="email" className="form-input"
                placeholder="admin@truedocs.local"
                value={email} onChange={(e) => setEmail(e.target.value)}
                disabled={loading} required autoComplete="email"/>
            </div>
            <div className="form-group">
              <label htmlFor="admin-password" className="form-label">Password</label>
              <input id="admin-password" type="password" className="form-input"
                placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)}
                disabled={loading} required autoComplete="current-password"/>
            </div>
            <button type="submit" className="btn btn-primary btn-lg"
              disabled={loading || !email || !password} style={{ width:"100%" }}>
              {loading ? <><span className="spinner" aria-hidden="true"/> Signing in…</> : "Sign In as Admin"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
