import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth, errorMessage } from "../context/AuthContext";
import { BrandMark, AlertIcon } from "../components/AppHeader";

// Login page: email + password, loading state, safe error feedback. Wrong
// credentials surface the backend's generic message ("Invalid email or
// password") — no enumeration, no internal details (STEP 7).
export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      // Success → AuthContext persists the session; App routes to /.
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-wrap">
        <span className="auth-brand">
          <BrandMark size={34} />
          Habit Shaper
        </span>
        <p className="auth-tagline">Build better habits, one day at a time.</p>
        <div className="auth-card">
          <h1>Welcome back</h1>
          <p className="auth-sub">Log in to continue shaping your habits.</p>
          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p role="alert" className="alert alert-error">
                <AlertIcon size={16} />
                <span>{error}</span>
              </p>
            )}
            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? "Logging in…" : "Log in"}
            </button>
          </form>
          <p className="auth-alt">
            New here? <Link to="/register">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
