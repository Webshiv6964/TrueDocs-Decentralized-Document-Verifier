import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { orgRequest } from "../services/api";

export default function OrgRequest() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    org_name: "", email: "", contact_person: "", purpose: "", password: "", confirm: "",
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);

  const update = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("Passwords do not match."); return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters."); return;
    }

    setLoading(true);
    try {
      await orgRequest({
        org_name:       form.org_name.trim(),
        email:          form.email.trim(),
        contact_person: form.contact_person.trim(),
        purpose:        form.purpose.trim(),
        password:       form.password,
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Failed to submit request.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="page-padded">
        <div className="container" style={{ maxWidth: 520, marginInline:"auto" }}>
          <div className="card" style={{ textAlign:"center" }}>
            <div style={{ fontSize:40, marginBottom:"var(--space-4)" }}>✅</div>
            <h2 style={{ fontSize:"var(--text-2xl)", fontWeight:700, marginBottom:"var(--space-3)" }}>
              Request Submitted
            </h2>
            <p style={{ color:"var(--dark-text-secondary)", marginBottom:"var(--space-6)" }}>
              Your access request has been submitted. The admin will review it and notify you by email.
              Your account status is <strong>Pending</strong> until approved.
            </p>
            <Link to="/org/login" className="btn btn-primary btn-lg" style={{ width:"100%" }}>
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-padded">
      <div className="container" style={{ maxWidth: 560, marginInline:"auto" }}>
        <div className="page-header" style={{ textAlign:"center" }}>
          <div className="page-eyebrow">Organizations</div>
          <h1 className="page-title" style={{ fontSize:"var(--text-3xl)" }}>Request Access</h1>
          <p style={{ color:"var(--dark-text-secondary)", fontSize:"var(--text-sm)" }}>
            Submit an access request to register documents on TrueDocs.
            An admin will review and approve your account.
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
              <label className="form-label">Organization Name *</label>
              <input type="text" className="form-input" placeholder="Acme University"
                value={form.org_name} onChange={update("org_name")} disabled={loading} required />
            </div>

            <div className="form-group">
              <label className="form-label">Official Email Address *</label>
              <input type="email" className="form-input" placeholder="admin@acme.edu"
                value={form.email} onChange={update("email")} disabled={loading} required autoComplete="email"/>
            </div>

            <div className="form-group">
              <label className="form-label">Contact Person *</label>
              <input type="text" className="form-input" placeholder="Jane Smith"
                value={form.contact_person} onChange={update("contact_person")} disabled={loading} required />
            </div>

            <div className="form-group">
              <label className="form-label">Purpose of Using TrueDocs *</label>
              <textarea className="form-input" rows={3}
                placeholder="e.g. Issuing and verifying academic certificates for graduates."
                value={form.purpose} onChange={update("purpose")} disabled={loading} required
                style={{ resize:"vertical", minHeight:80 }} />
            </div>

            <div className="form-group">
              <label className="form-label">Password *</label>
              <input type="password" className="form-input" placeholder="At least 8 characters"
                value={form.password} onChange={update("password")} disabled={loading} required autoComplete="new-password"/>
              <p className="form-hint">Minimum 8 characters</p>
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password *</label>
              <input type="password" className="form-input" placeholder="Repeat your password"
                value={form.confirm} onChange={update("confirm")} disabled={loading} required autoComplete="new-password"/>
            </div>

            <button type="submit" className="btn btn-primary btn-lg"
              disabled={loading || !form.org_name || !form.email || !form.contact_person || !form.purpose || !form.password || !form.confirm}
              style={{ width:"100%" }}>
              {loading ? <><span className="spinner" aria-hidden="true"/> Submitting…</> : "Submit Request"}
            </button>
          </form>
        </div>

        <p style={{ textAlign:"center", marginTop:"var(--space-6)", fontSize:"var(--text-sm)", color:"var(--dark-text-secondary)" }}>
          Already have an account?{" "}
          <Link to="/org/login" style={{ color:"var(--color-brand-400)", fontWeight:600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
