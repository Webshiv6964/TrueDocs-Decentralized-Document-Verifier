import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function LogoMark() {
  return (
    <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 2h7l3 3v9H3V2z" stroke="white" strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
      <path d="M10 2v3h3" stroke="white" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M6 8h4M6 11h2.5" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="5.5" cy="8" r="1" fill="rgba(255,255,255,0.6)"/>
      <circle cx="5.5" cy="11" r="1" fill="rgba(255,255,255,0.6)"/>
    </svg>
  );
}

export default function Navbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isOrgLoggedIn, isAdminLoggedIn, orgInfo, logout } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const navItems = [
    { to: "/",      label: "Home"   },
    { to: "/verify", label: "Verify" },
  ];

  return (
    <header className={`navbar${scrolled ? " navbar--scrolled" : ""}`}>
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand" aria-label="TrueDocs home">
          <div className="navbar-logo"><LogoMark /></div>
          <span className="navbar-wordmark">True<span>Docs</span></span>
        </Link>

        <nav aria-label="Main navigation">
          <ul className="navbar-links" role="list">
            {navItems.map(({ to, label }) => (
              <li key={to}>
                <Link to={to} className={`nav-link${pathname === to ? " nav-link--active" : ""}`}>
                  {label}
                </Link>
              </li>
            ))}

            {isOrgLoggedIn && (
              <li>
                <Link to="/org/dashboard" className={`nav-link${pathname === "/org/dashboard" ? " nav-link--active" : ""}`}>
                  Dashboard
                </Link>
              </li>
            )}

            {isAdminLoggedIn && (
              <li>
                <Link to="/admin/dashboard" className={`nav-link${pathname === "/admin/dashboard" ? " nav-link--active" : ""}`}>
                  Admin
                </Link>
              </li>
            )}
          </ul>
        </nav>

        <div className="navbar-cta">
          {isOrgLoggedIn ? (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--dark-text-secondary)" }}>
                {orgInfo?.org_name}
              </span>
              <button onClick={handleLogout} className="btn btn-ghost btn-sm">
                Log Out
              </button>
            </div>
          ) : isAdminLoggedIn ? (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--color-warning-500)", fontWeight: 600 }}>
                ADMIN
              </span>
              <button onClick={handleLogout} className="btn btn-ghost btn-sm">
                Log Out
              </button>
            </div>
          ) : (
            <Link to="/org/login" className="btn btn-primary btn-sm">
              Org Login
            </Link>
          )}

          <button
            className={`nav-toggle${menuOpen ? " is-open" : ""}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label="Toggle navigation menu"
          >
            <span className="nav-toggle-bar"/>
            <span className="nav-toggle-bar"/>
            <span className="nav-toggle-bar"/>
          </button>
        </div>
      </div>

      <nav className={`mobile-menu${menuOpen ? " is-open" : ""}`} aria-label="Mobile navigation" aria-hidden={!menuOpen}>
        {navItems.map(({ to, label }) => (
          <Link key={to} to={to} className={`nav-link${pathname === to ? " nav-link--active" : ""}`}>{label}</Link>
        ))}
        {isOrgLoggedIn && (
          <Link to="/org/dashboard" className="nav-link">Dashboard</Link>
        )}
        {isAdminLoggedIn && (
          <Link to="/admin/dashboard" className="nav-link">Admin</Link>
        )}
        <div style={{ padding: "var(--space-3) var(--space-6) 0" }}>
          {isOrgLoggedIn || isAdminLoggedIn ? (
            <button onClick={handleLogout} className="btn btn-ghost" style={{ width: "100%" }}>
              Log Out
            </button>
          ) : (
            <Link to="/org/login" className="btn btn-primary" style={{ width: "100%" }}>
              Org Login
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
