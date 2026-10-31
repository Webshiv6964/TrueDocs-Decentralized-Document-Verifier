/**
 * AuthContext.jsx
 * Manages org and admin session state.
 * Tokens are stored in localStorage under 'truedocs_token' and 'truedocs_role'.
 */

import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token,   setToken]   = useState(() => localStorage.getItem("truedocs_token"));
  const [role,    setRole]    = useState(() => localStorage.getItem("truedocs_role"));   // "org" | "admin"
  const [orgInfo, setOrgInfo] = useState(() => {
    try {
      const raw = localStorage.getItem("truedocs_org");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const loginOrg = (data) => {
    localStorage.setItem("truedocs_token", data.access_token);
    localStorage.setItem("truedocs_role",  "org");
    const info = { org_id: data.org_id, org_name: data.org_name, email: data.email };
    localStorage.setItem("truedocs_org",   JSON.stringify(info));
    setToken(data.access_token);
    setRole("org");
    setOrgInfo(info);
  };

  const loginAdmin = (data) => {
    localStorage.setItem("truedocs_token", data.access_token);
    localStorage.setItem("truedocs_role",  "admin");
    localStorage.removeItem("truedocs_org");
    setToken(data.access_token);
    setRole("admin");
    setOrgInfo(null);
  };

  const logout = () => {
    localStorage.removeItem("truedocs_token");
    localStorage.removeItem("truedocs_role");
    localStorage.removeItem("truedocs_org");
    setToken(null);
    setRole(null);
    setOrgInfo(null);
  };

  const isOrgLoggedIn   = role === "org"   && !!token;
  const isAdminLoggedIn = role === "admin" && !!token;

  return (
    <AuthContext.Provider value={{
      token, role, orgInfo,
      isOrgLoggedIn, isAdminLoggedIn,
      loginOrg, loginAdmin, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
