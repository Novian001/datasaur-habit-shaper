import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth, errorMessage } from "../context/AuthContext";
import { getHabit, completeHabit, uncompleteHabit, recordRelapse, type HabitDetail } from "../api/habits";
import AppHeader, { ArrowLeftIcon, FlameIcon, AlertIcon } from "../components/AppHeader";

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
      <div className="shell">
        <AppHeader />
        <main className="shell-main">
          <p role="alert" className="alert alert-error">
            <AlertIcon size={16} />
            <span>{error}</span>
          </p>
          <Link to="/">← Back to dashboard</Link>
        </main>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="shell">
        <AppHeader />
        <main className="shell-main">
          <div className="page-loading">Loading habit…</div>
        </main>
      </div>
    );
  }

  const s = detail.stats;
  const pct = Math.round(((s.weekCompleted ?? 0) / (s.weekElapsedDays ?? 1)) * 100);

  return (
    <div className="shell">
      <AppHeader />
      <main className="shell-main">
        <Link to="/" className="back-link">
          <ArrowLeftIcon size={14} /> Dashboard
        </Link>

        <div className="detail-hero">
          <div>
            <h1>{detail.habit.name}</h1>
            <div className="detail-meta">
              <span className={`badge badge-${detail.habit.type.toLowerCase()}`}>{detail.habit.type}</span>
              <span>Since {detail.habit.startDate}</span>
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="alert alert-error">
            <AlertIcon size={16} />
            <span>{error}</span>
          </p>
        )}

        <section className="stats-panel">
          {isBuild ? (
            <>
              <div className="card stat">
                <span className="stat-value">
                  {s.currentStreak ?? 0} <FlameIcon size={16} />
                </span>
                <span className="stat-label">day streak</span>
              </div>
              <div className="card stat">
                <span className="stat-value">
                  {s.weekCompleted ?? 0}/{s.weekElapsedDays ?? 0}
                </span>
                <span className="stat-label">this week</span>
              </div>
              <div className="card stat">
                <span className="stat-value">{s.weekCompletionRate != null ? Math.round(s.weekCompletionRate * 100) : 0}%</span>
                <span className="stat-label">completion rate</span>
              </div>
              <div className="card stat">
                <span className="stat-value">{s.missedDays ?? 0}</span>
                <span className="stat-label">missed days</span>
              </div>
            </>
          ) : (
            <>
              <div className="card stat">
                <span className="stat-value">{s.cleanStreak ?? 0}</span>
                <span className="stat-label">clean streak (days)</span>
              </div>
              <div className="card stat">
                <span className="stat-value">{s.lastRelapseDate ?? "—"}</span>
                <span className="stat-label">last relapse</span>
              </div>
            </>
          )}
        </section>

        {isBuild && (
          <section className="section-block">
            <h2>This week</h2>
            <div className="card" style={{ padding: "var(--space-4)" }}>
              <div className="week-progress">
                <span className="week-progress-track">
                  <span className="week-progress-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
                </span>
                <span className="week-progress-label">
                  {s.weekCompleted ?? 0}/{s.weekElapsedDays ?? 0} completed
                </span>
              </div>
              <p className="helper" style={{ marginTop: "var(--space-3)", marginBottom: 0 }}>
                {pct}% completion rate · {s.missedDays ?? 0} day{s.missedDays === 1 ? "" : "s"} missed
              </p>
            </div>
          </section>
        )}

        <section className="section-block">
          <h2>{isBuild ? "Completed dates" : "Relapse dates"}</h2>
          {dates.length === 0 ? (
            <p className="empty-state" style={{ textAlign: "center", padding: "var(--space-5)" }}>
              No {isBuild ? "completions" : "relapses"} yet.
            </p>
          ) : (
            <ul className="date-list">
              {dates.map((d) => (
                <li key={d} className="date-row">
                  <span>{d}</span>
                  {isBuild ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busyDate === d}
                      onClick={() => void toggleDate(d)}
                    >
                      {busyDate === d ? "…" : "Undo"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
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
