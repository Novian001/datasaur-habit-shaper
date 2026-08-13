import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
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
import AppHeader, { CheckIcon, FlameIcon, AlertIcon, TargetIcon } from "../components/AppHeader";

// Dashboard: habit list + create form + daily completion (BUILD) and relapse
// (BREAK) buttons (contract §2–§4). Dates are the browser's local calendar
// date (D8). This is Phase 8 scope — goals UI is Phase 9.
export default function Dashboard() {
  const { token } = useAuth();
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

  async function handleToggleComplete(habit: Habit, date: string) {
    if (!token) return;
    setBusyId(habit.id);
    setError(null);
    try {
      await completeHabit(token, habit.id, date);
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
    return (
      <div className="shell">
        <AppHeader />
        <main className="shell-main">
          <div className="page-loading">Loading your habits…</div>
        </main>
      </div>
    );
  }

  const buildCount = habits.filter((h) => h.type === "BUILD").length;
  const breakCount = habits.length - buildCount;
  const todayDone = habits.filter(
    (h) => h.type === "BUILD" && (h.stats.weekCompleted ?? 0) > 0 && h.stats.currentStreak !== undefined,
  ).length;

  return (
    <div className="shell">
      <AppHeader />
      <main className="shell-main">
        <div className="page-intro">
          <h1>Today&apos;s habits</h1>
          <p>Keep your daily rhythm — a quick view of what to build and what to break.</p>
        </div>

        {error && (
          <p role="alert" className="alert alert-error">
            <AlertIcon size={16} />
            <span>{error}</span>
          </p>
        )}
        {notice && (
          <p role="status" className="alert alert-success">
            <CheckIcon size={16} />
            <span>{notice}</span>
          </p>
        )}

        {habits.length === 0 ? (
          <div className="empty-state">
            <TargetIcon size={36} />
            <h3>Start with one habit</h3>
            <p>Create your first habit below — something small you can do every day.</p>
          </div>
        ) : (
          <>
            <div className="summary-strip" aria-label="Habit summary">
              <div className="card summary-item">
                <span className="summary-value">{habits.length}</span>
                <span className="summary-label">Total habits</span>
              </div>
              <div className="card summary-item">
                <span className="summary-value">{buildCount}</span>
                <span className="summary-label">BUILD</span>
              </div>
              <div className="card summary-item">
                <span className="summary-value">{breakCount}</span>
                <span className="summary-label">BREAK</span>
              </div>
              <div className="card summary-item">
                <span className="summary-value">{todayDone}</span>
                <span className="summary-label">Done today</span>
              </div>
            </div>

            <ul className="habit-list">
              {habits.map((h) => (
                <li key={h.id} className="card habit-card">
                  <div className="habit-head">
                    <div className="habit-title-row">
                      <Link to={`/habits/${h.id}`} className="habit-title">
                        {h.name}
                      </Link>
                      <span className={`badge badge-${h.type.toLowerCase()}`}>{h.type}</span>
                    </div>
                    <span className="habit-meta">Since {h.startDate}</span>

                    {h.type === "BUILD" ? (
                      <div className="habit-metric">
                        <span className="habit-metric-value">{h.stats.currentStreak ?? 0}</span>
                        <span className="habit-metric-label">
                          day streak <FlameIcon size={14} />
                        </span>
                      </div>
                    ) : (
                      <div className="habit-metric">
                        <span className="habit-metric-value">{h.stats.cleanStreak ?? 0}</span>
                        <span className="habit-metric-label">clean days</span>
                      </div>
                    )}
                  </div>

                  <div className="habit-foot">
                    {h.type === "BUILD" ? (
                      <>
                        <div className="week-progress">
                          <span className="week-progress-track">
                            <span
                              className="week-progress-fill"
                              style={{
                                width: `${Math.round(((h.stats.weekCompleted ?? 0) / (h.stats.weekElapsedDays ?? 1)) * 100)}%`,
                              }}
                            />
                          </span>
                          <span className="week-progress-label">
                            {h.stats.weekCompleted ?? 0}/{h.stats.weekElapsedDays ?? 0}
                          </span>
                        </div>
                        <div className="habit-footline">
                          <span className="foot-item">
                            Week: <strong>{h.stats.weekCompleted ?? 0}/{h.stats.weekElapsedDays ?? 0}</strong>
                          </span>
                          <span className="foot-item">
                            Missed: <strong>{h.stats.missedDays ?? 0}</strong>
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="habit-footline">
                        <span className="foot-item">
                          Last relapse: <strong>{h.stats.lastRelapseDate ?? "—"}</strong>
                        </span>
                      </div>
                    )}

                    <div className="habit-actions">
                      {h.type === "BUILD" ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={busyId === h.id}
                          onClick={() => void handleToggleComplete(h, today)}
                        >
                          <CheckIcon size={14} /> {busyId === h.id ? "Saving…" : "Complete today"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={busyId === h.id}
                          onClick={() => void handleRelapse(h, today)}
                        >
                          <FlameIcon size={14} /> {busyId === h.id ? "Saving…" : "Record relapse"}
                        </button>
                      )}
                      <Link to={`/habits/${h.id}`} className="btn btn-secondary btn-sm">
                        View details
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        <section className="create-section">
          <h2>Create a habit</h2>
          <p className="section-sub">Start small — you can always adjust later.</p>
          <form onSubmit={handleCreate} className="card create-panel">
            <div className="field">
              <label htmlFor="habit-name">Name</label>
              <input
                id="habit-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                placeholder="e.g. Meditate, No doomscrolling"
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
              <p role="alert" className="alert alert-error">
                <AlertIcon size={16} />
                <span>{createError}</span>
              </p>
            )}
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={creating}>
                {creating ? "Creating…" : "Create habit"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
