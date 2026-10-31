import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import Navbar    from "./components/Navbar";
import Footer    from "./components/Footer";

// Public pages
import Home      from "./pages/Home";
import Verify    from "./pages/Verify";
import PublicVerify from "./pages/PublicVerify";

// Org pages
import OrgLogin   from "./pages/OrgLogin";
import OrgRequest from "./pages/OrgRequest";
import OrgDashboard from "./pages/OrgDashboard";

// Admin pages
import AdminLogin     from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";

// ── Route guards ───────────────────────────────────────────────────────────────
function RequireOrg({ children }) {
  const { isOrgLoggedIn } = useAuth();
  return isOrgLoggedIn ? children : <Navigate to="/org/login" replace />;
}

function RequireAdmin({ children }) {
  const { isAdminLoggedIn } = useAuth();
  return isAdminLoggedIn ? children : <Navigate to="/admin/login" replace />;
}

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <main className="main-content">
        <Routes>
          {/* ── Public ────────────────────────────────────────── */}
          <Route path="/"               element={<Home />} />
          <Route path="/verify"         element={<PublicVerify />} />
          <Route path="/verify/legacy"  element={<Verify />} />

          {/* ── Organization ──────────────────────────────────── */}
          <Route path="/org/login"    element={<OrgLogin />} />
          <Route path="/org/request"  element={<OrgRequest />} />
          <Route path="/org/dashboard" element={
            <RequireOrg><OrgDashboard /></RequireOrg>
          } />

          {/* ── Admin ─────────────────────────────────────────── */}
          <Route path="/admin/login"     element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={
            <RequireAdmin><AdminDashboard /></RequireAdmin>
          } />

          {/* ── Catch-all ─────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
