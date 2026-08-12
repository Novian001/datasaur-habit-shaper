import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, errorMessage } from "../context/AuthContext";
import { todayLocal } from "../lib/date";
import {
  listHabits,
  createHabit,
  completeHabit,
  recordRelapse,
  type Habit,
  type HabitType,
} from "../api/habits";

// Dashboard: habit list + create form + daily completion (BUILD) and relapse
// (BREAK) buttons (contract §2–§4). Dates are the browser's local calendar
// date (D8). This is Phase 8 scope — goals UI is Phase 9.
export default function Dashboard() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Create-form state
  const [name, setName] = useState("");
  const [type, setType] = useState<HabitType>("BUILD");
  const [startDate, setStartDate] = useState(todayLocal());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setHabits((await listHabits(token)).habits);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!token || !name.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createHabit(token, { name: name.trim(), type, startDate });
      setName("");
      await load();
      setNotice(`Created ${type.toLowerCase()} habit.`);
    } catch (err) {
      setCreateError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  const today = todayLocal();

  function handleLogout() {
    logout(); // clears persisted JWT + user state
    navigate("/login", { replace: true });
  }

  async function handleToggleComplete(habit: Habit, date: string) {
    if (!token) return;
    setBusyId(habit.id);
    setError(null);
    try {
      if (habit.stats.currentStreak !== undefined) {
        // BUILD: PUT marks; if already completed (via detail), DELETE undoes.
        // Simplest: try PUT; a completed date returns 200 idempotently — so
        // the dashboard toggles only via the detail page. Here we mark today.
        await completeHabit(token, habit.id, date);
      }
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRelapse(habit: Habit, date: string) {
    if (!token) return;
    setBusyId(habit.id);
    setError(null);
    try {
      await recordRelapse(token, habit.id, date);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  if (habits === null) {
    return <div className="page-loading">Loading your habits…</div>;
  }

  return (
    <div className="dashboard">
      <header className="shell-header">
        <span className="shell-brand">Habit Shaper</span>
        <span className="shell-user">Dashboard</span>
        <button type="button" className="btn-ghost" onClick={handleLogout}>
          Logout
        </button>
      </header>
      <main className="shell-main">
        <h1>Today&apos;s habits</h1>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {notice && <p className="form-notice">{notice}</p>}
        {habits.length === 0 ? (
          <p className="empty">No habits yet — create your first one below.</p>
        ) : (
          <ul className="habit-list">
            {habits.map((h) => (
              <li key={h.id} className="habit-card">
                <div className="habit-info">
                  <Link to={`/habits/${h.id}`} className="habit-name">
                    {h.name}
                  </Link>
                  <span className={`badge badge-${h.type.toLowerCase()}`}>{h.type}</span>
                  <span className="habit-date">since {h.startDate}</span>
                </div>
                <div className="habit-stats">
                  {h.type === "BUILD" ? (
                    <>
                      <span>Streak: {h.stats.currentStreak ?? 0}d</span>
                      <span>
                        Week: {h.stats.weekCompleted ?? 0}/{h.stats.weekElapsedDays ?? 0}
                      </span>
                      <span>Missed: {h.stats.missedDays ?? 0}</span>
                    </>
                  ) : (
                    <>
                      <span>Clean: {h.stats.cleanStreak ?? 0}d</span>
                      <span>Last relapse: {h.stats.lastRelapseDate ?? "—"}</span>
                    </>
                  )}
                </div>
                <div className="habit-actions">
                  {h.type === "BUILD" ? (
                    <button
                      type="button"
                      className="btn-primary btn-small"
                      disabled={busyId === h.id}
                      onClick={() => void handleToggleComplete(h, today)}
                    >
                      {busyId === h.id ? "Saving…" : "Complete today"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-danger btn-small"
                      disabled={busyId === h.id}
                      onClick={() => void handleRelapse(h, today)}
                    >
                      {busyId === h.id ? "Saving…" : "Relapse today"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <section className="create-section">
          <h2>Create a habit</h2>
          <form onSubmit={handleCreate} className="create-form">
            <div className="field">
              <label htmlFor="habit-name">Name</label>
              <input
                id="habit-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="habit-type">Type</label>
              <select id="habit-type" value={type} onChange={(e) => setType(e.target.value as HabitType)}>
                <option value="BUILD">BUILD — do more of this</option>
                <option value="BREAK">BREAK — stop doing this</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="habit-start">Start date</label>
              <input id="habit-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            {createError && (
              <p role="alert" className="form-error">
                {createError}
              </p>
            )}
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? "Creating…" : "Create habit"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
