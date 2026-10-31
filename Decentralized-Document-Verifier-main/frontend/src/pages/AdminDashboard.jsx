import React, { useState, useEffect } from "react";
import { adminListOrgs, adminApproveOrg, adminRejectOrg } from "../services/api";

function StatusBadge({ status }) {
  const map = {
    PENDING:  "badge--pending",
    APPROVED: "badge--valid",
    REJECTED: "badge--invalid",
  };
  return (
    <span className={`badge ${map[status] || "badge--pending"}`}>
      <span className="badge-dot"/>{status}
    </span>
  );
}

function OrgCard({ org, onApprove, onReject, busy }) {
  return (
    <div className="card card-sm" style={{ padding:"var(--space-5)" }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"var(--space-3)", marginBottom:"var(--space-3)" }}>
        <div>
          <div style={{ fontWeight:700, fontSize:"var(--text-md)", marginBottom:"var(--space-1)" }}>
            {org.org_name}
          </div>
          <div style={{ fontSize:"var(--text-sm)", color:"var(--dark-text-secondary)" }}>{org.email}</div>
          <div style={{ fontSize:"var(--text-xs)", color:"var(--dark-text-tertiary)", marginTop:"var(--space-1)" }}>
            Contact: {org.contact_person}
          </div>
        </div>
        <StatusBadge status={org.status}/>
      </div>

      <details style={{ marginBottom:"var(--space-3)" }}>
        <summary style={{ cursor:"pointer", fontSize:"var(--text-xs)", color:"var(--dark-text-secondary)", userSelect:"none" }}>
          View purpose
        </summary>
        <p style={{ marginTop:"var(--space-2)", fontSize:"var(--text-xs)", color:"var(--dark-text-secondary)", lineHeight:"var(--leading-relaxed)", padding:"var(--space-2)", background:"var(--dark-surface-2)", borderRadius:"var(--radius-sm)" }}>
          {org.purpose}
        </p>
      </details>

      <div style={{ fontSize:"var(--text-xs)", color:"var(--dark-text-tertiary)", marginBottom:"var(--space-4)" }}>
        Submitted: {org.created_at ? new Date(org.created_at).toLocaleString() : "—"}
        {org.approved_at && <span> · Approved: {new Date(org.approved_at).toLocaleString()}</span>}
        {org.rejected_at && <span> · Rejected: {new Date(org.rejected_at).toLocaleString()}</span>}
      </div>

      {org.status === "PENDING" && (
        <div style={{ display:"flex", gap:"var(--space-3)" }}>
          <button className="btn btn-primary btn-sm" onClick={() => onApprove(org.id)} disabled={busy}>
            {busy === org.id + "approve" ? <><span className="spinner spinner-sm" aria-hidden="true"/> Approving…</> : "✓ Approve"}
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => onReject(org.id)} disabled={busy}>
            {busy === org.id + "reject" ? <><span className="spinner spinner-sm" aria-hidden="true"/> Rejecting…</> : "✗ Reject"}
          </button>
        </div>
      )}
      {org.status === "APPROVED" && (
        <button className="btn btn-danger btn-sm" onClick={() => onReject(org.id)} disabled={busy}>
          Revoke Approval
        </button>
      )}
      {org.status === "REJECTED" && (
        <button className="btn btn-secondary btn-sm" onClick={() => onApprove(org.id)} disabled={busy}>
          Re-Approve
        </button>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [data,     setData]    = useState(null);
  const [loading,  setLoading] = useState(true);
  const [error,    setError]   = useState("");
  const [busy,     setBusy]    = useState(null);
  const [toast,    setToast]   = useState("");
  const [tab,      setTab]     = useState("pending");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const d = await adminListOrgs();
      setData(d);
    } catch (e) {
      setError(e.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (id) => {
    setBusy(id + "approve");
    try {
      const r = await adminApproveOrg(id);
      setToast(r.message);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
      setTimeout(() => setToast(""), 3500);
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm("Reject this organization?")) return;
    setBusy(id + "reject");
    try {
      const r = await adminRejectOrg(id);
      setToast(r.message);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
      setTimeout(() => setToast(""), 3500);
    }
  };

  const tabOrgs = {
    pending:  data?.pending  || [],
    approved: data?.approved || [],
    rejected: data?.rejected || [],
  };

  return (
    <div className="page-padded">
      <div className="container">

        {/* Toast */}
        {toast && (
          <div className="alert alert--success" role="status" style={{ position:"fixed", top:80, right:24, zIndex:700, maxWidth:380, animation:"fadeUp 0.3s ease" }}>
            <div className="alert-body">{toast}</div>
            <button className="alert-close" onClick={() => setToast("")}>✕</button>
          </div>
        )}

        <div style={{ marginBottom:"var(--space-8)" }}>
          <div className="page-eyebrow" style={{ color:"var(--color-warning-500)" }}>Administrator</div>
          <h1 className="page-title">Organization Approvals</h1>
          <p style={{ color:"var(--dark-text-secondary)", fontSize:"var(--text-sm)" }}>
            Review and manage organization access requests.
          </p>
        </div>

        {/* Stats */}
        {data && (
          <div style={{ display:"flex", gap:"var(--space-4)", marginBottom:"var(--space-8)", flexWrap:"wrap" }}>
            {[
              { label:"Total",    val: data.total,              color:"var(--color-brand-400)" },
              { label:"Pending",  val: data.pending?.length,    color:"var(--color-warning-500)" },
              { label:"Approved", val: data.approved?.length,   color:"var(--color-success-500)" },
              { label:"Rejected", val: data.rejected?.length,   color:"var(--color-error-500)" },
            ].map(s => (
              <div key={s.label} className="card card-sm" style={{ flex:"1 1 120px", textAlign:"center", padding:"var(--space-5)" }}>
                <div style={{ fontSize:"var(--text-3xl)", fontWeight:700, color:s.color }}>{s.val ?? 0}</div>
                <div style={{ fontSize:"var(--text-xs)", color:"var(--dark-text-tertiary)", marginTop:"var(--space-1)" }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="alert alert--error" role="alert" style={{ marginBottom:"var(--space-6)" }}>
            <div className="alert-body">{error}</div>
            <button className="alert-close" onClick={() => setError("")}>✕</button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign:"center", padding:"var(--space-16)" }}>
            <span className="spinner spinner-lg" style={{ color:"var(--color-brand-400)" }}/>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="verify-tabs" role="tablist" style={{ marginBottom:"var(--space-6)" }}>
              {["pending","approved","rejected"].map(t => (
                <button key={t} role="tab" aria-selected={tab===t}
                  className={`verify-tab${tab===t?" verify-tab--active":""}`}
                  onClick={() => setTab(t)}>
                  {t.charAt(0).toUpperCase()+t.slice(1)} ({tabOrgs[t].length})
                </button>
              ))}
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:"var(--space-4)" }}>
              {tabOrgs[tab].length === 0 ? (
                <div className="card" style={{ textAlign:"center", color:"var(--dark-text-secondary)", padding:"var(--space-10)" }}>
                  No {tab} organizations.
                </div>
              ) : (
                tabOrgs[tab].map(org => (
                  <OrgCard key={org.id} org={org}
                    onApprove={handleApprove} onReject={handleReject} busy={busy}/>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
