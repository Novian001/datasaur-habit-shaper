import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth, errorMessage } from "../context/AuthContext";
import { getHabit, completeHabit, uncompleteHabit, recordRelapse, type HabitDetail } from "../api/habits";

// Habit detail: stats + completion/relapse history (contract §2 GET /:id).
// BUILD → completedDates (toggle on/off); BREAK → relapseDates (record only).
export default function HabitDetailPage() {
  const { token } = useAuth();
  const { id } = useParams();
  const [detail, setDetail] = useState<HabitDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyDate, setBusyDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      setDetail(await getHabit(token, Number(id)));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const isBuild = detail?.habit.type === "BUILD";
  const dates = isBuild ? detail?.completedDates ?? [] : detail?.relapseDates ?? [];

  async function toggleDate(date: string) {
    if (!token || !detail) return;
    setBusyDate(date);
    setError(null);
    try {
      if (isBuild) {
        if (detail.completedDates?.includes(date)) {
          await uncompleteHabit(token, detail.habit.id, date);
        } else {
          await completeHabit(token, detail.habit.id, date);
        }
      }
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyDate(null);
    }
  }

  async function relapseOn(date: string) {
    if (!token || !detail) return;
    setBusyDate(date);
    setError(null);
    try {
      await recordRelapse(token, detail.habit.id, date);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyDate(null);
    }
  }

  if (error && !detail) {
    return (
      <div className="shell-main">
        <p role="alert" className="form-error">
          {error}
        </p>
        <Link to="/">← Back to dashboard</Link>
      </div>
    );
  }
  if (!detail) {
    return <div className="page-loading">Loading habit…</div>;
  }

  const s = detail.stats;
  return (
    <div className="dashboard">
      <header className="shell-header">
        <span className="shell-brand">Habit Shaper</span>
        <span className="shell-user">Habit detail</span>
        <Link to="/" className="btn-ghost">
          ← Dashboard
        </Link>
      </header>
      <main className="shell-main">
        <h1>{detail.habit.name}</h1>
        <p className="auth-sub">
          <span className={`badge badge-${detail.habit.type.toLowerCase()}`}>{detail.habit.type}</span> since{" "}
          {detail.habit.startDate}
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <section className="stats-panel">
          {detail.habit.type === "BUILD" ? (
            <>
              <div className="stat">
                <span className="stat-value">{s.currentStreak ?? 0}</span>
                <span className="stat-label">day streak</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {s.weekCompleted ?? 0}/{s.weekElapsedDays ?? 0}
                </span>
                <span className="stat-label">this week</span>
              </div>
              <div className="stat">
                <span className="stat-value">{s.weekCompletionRate != null ? Math.round(s.weekCompletionRate * 100) : 0}%</span>
                <span className="stat-label">completion rate</span>
              </div>
              <div className="stat">
                <span className="stat-value">{s.missedDays ?? 0}</span>
                <span className="stat-label">missed days</span>
              </div>
            </>
          ) : (
            <>
              <div className="stat">
                <span className="stat-value">{s.cleanStreak ?? 0}</span>
                <span className="stat-label">clean streak (days)</span>
              </div>
              <div className="stat">
                <span className="stat-value">{s.lastRelapseDate ?? "—"}</span>
                <span className="stat-label">last relapse</span>
              </div>
            </>
          )}
        </section>

        <section>
          <h2>{isBuild ? "Completed dates" : "Relapse dates"}</h2>
          {dates.length === 0 ? (
            <p className="empty">No {isBuild ? "completions" : "relapses"} yet.</p>
          ) : (
            <ul className="date-list">
              {dates.map((d) => (
                <li key={d} className="date-row">
                  <span>{d}</span>
                  {isBuild ? (
                    <button
                      type="button"
                      className="btn-ghost btn-small"
                      disabled={busyDate === d}
                      onClick={() => void toggleDate(d)}
                    >
                      {busyDate === d ? "…" : "Undo"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-danger btn-small"
                      disabled={busyDate === d}
                      onClick={() => void relapseOn(d)}
                    >
                      {busyDate === d ? "…" : "Record again"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
