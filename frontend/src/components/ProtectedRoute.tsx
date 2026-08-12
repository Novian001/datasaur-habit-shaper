import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Auth guard (architecture.md §2): unauthenticated visitors of protected
// pages are redirected to /login. While a stored token is being validated
// against /api/auth/me, render a minimal loading state instead of flashing
// the login page.
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, bootstrapping } = useAuth();
  const location = useLocation();

  if (bootstrapping) {
    return <div className="page-loading">Checking your session…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
