import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth, errorMessage } from "../context/AuthContext";
import { BrandMark, AlertIcon } from "../components/AppHeader";

// Register page (Phase 7 scope only): email + password, client-side required
// validation, backend is the source of truth. No email verification / OAuth /
// reset flows (architecture.md §3 R1/R2). Backend returns { user, token } on
// registration → session is persisted immediately (STEP 4/6).
export default function Register() {
  const { register } = useAuth();
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
      await register(email.trim(), password);
      // Success → AuthContext persists the session; the protected shell
      // renders (App routes authenticated users to /).
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
          <h1>Create your account</h1>
          <p className="auth-sub">Start shaping a new habit.</p>
          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="register-email">Email</label>
              <input
                id="register-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="register-password">Password</label>
              <input
                id="register-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="helper">At least 8 characters.</p>
            </div>
            {error && (
              <p role="alert" className="alert alert-error">
                <AlertIcon size={16} />
                <span>{error}</span>
              </p>
            )}
            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? "Creating account…" : "Create account"}
            </button>
          </form>
          <p className="auth-alt">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
