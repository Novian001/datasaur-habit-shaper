import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Minimal protected application shell (STEP 8): proves protected routing and
// session lifecycle only. Habit/goal UI arrives in later phases.
export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout(); // clears persisted JWT + user state
    navigate("/login", { replace: true });
  }

  return (
    <div className="shell">
      <header className="shell-header">
        <span className="shell-brand">Habit Shaper</span>
        <span className="shell-user">{user?.email}</span>
        <button type="button" className="btn-ghost" onClick={handleLogout}>
          Logout
        </button>
      </header>
      <main className="shell-main">
        <h1>Welcome{user ? `, ${user.email}` : ""}</h1>
        <p>Dashboard features are coming in the next phase.</p>
      </main>
    </div>
  );
}
