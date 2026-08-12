import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./components/AppShell";
import Login from "./pages/Login";
import Register from "./pages/Register";

// Authenticated users visiting /login or /register are redirected to the
// protected shell (STEP 8). Implemented with a tiny wrapper instead of
// conditional children so the redirect stays at route level.
function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, bootstrapping } = useAuth();
  const location = useLocation();

  // While a stored token is being validated, don't flash the auth pages.
  if (bootstrapping) {
    return <div className="page-loading">Checking your session…</div>;
  }
  if (user) {
    const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;
    return <Navigate to={from && from !== "/login" && from !== "/register" ? from : "/"} replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <Login />
          </PublicOnly>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnly>
            <Register />
          </PublicOnly>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Keeps the scroll position sane when navigating between pages.
function ScrollReset() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <ScrollReset />
      <div className="app">
        <AppRoutes />
      </div>
    </AuthProvider>
  );
}
