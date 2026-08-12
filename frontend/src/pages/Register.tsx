import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth, errorMessage } from "../context/AuthContext";

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
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="auth-alt">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
