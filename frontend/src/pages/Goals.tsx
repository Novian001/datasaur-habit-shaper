import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, errorMessage } from "../context/AuthContext";
import { listHabits, type Habit } from "../api/habits";
import {
  listGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  type Goal,
} from "../api/goals";

// Goals page (contract §5): list, create, inline edit (title/description/
// relink), delete. Habit selector is populated from the authenticated user's
// own habits only (ownership enforced backend-side, D7). Goals UI is Phase 9;
// no deadlines/progress/priority — the model is minimal by design (D6).
export default function GoalsPage() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [pageError, setPageError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Create form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [habitId, setHabitId] = useState<number | "">("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit state: goal id being edited, or null
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editHabitId, setEditHabitId] = useState<number | "">("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [g, h] = await Promise.all([listGoals(token), listHabits(token)]);
      setGoals(g.goals);
      setHabits(h.habits);
      setPageError(null);
    } catch (err) {
      setPageError(errorMessage(err));
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!token || !title.trim() || habitId === "") return;
    setCreating(true);
    setCreateError(null);
    try {
      await createGoal(token, {
        habitId,
        title: title.trim(),
        description: description.trim() === "" ? null : description.trim(),
      });
      setTitle("");
      setDescription("");
      setHabitId("");
      setNotice("Goal created.");
      await load();
    } catch (err) {
      setCreateError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(g: Goal) {
    setEditingId(g.id);
    setEditTitle(g.title);
    setEditDescription(g.description ?? "");
    setEditHabitId(g.habitId);
    setEditError(null);
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!token || editingId === null || !editTitle.trim() || editHabitId === "") return;
    setSavingEdit(true);
    setEditError(null);
    try {
      await updateGoal(token, editingId, {
        title: editTitle.trim(),
        description: editDescription.trim() === "" ? null : editDescription.trim(),
        habitId: editHabitId,
      });
      setEditingId(null);
      setNotice("Goal updated.");
      await load();
    } catch (err) {
      setEditError(errorMessage(err));
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(g: Goal) {
    if (!token) return;
    if (!window.confirm(`Delete goal "${g.title}"? The linked habit stays.`)) return;
    setDeletingId(g.id);
    setPageError(null);
    try {
      await deleteGoal(token, g.id);
      setNotice("Goal deleted.");
      await load();
    } catch (err) {
      setPageError(errorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  if (goals === null) {
    return <div className="page-loading">Loading goals…</div>;
  }

  return (
    <div className="dashboard">
      <header className="shell-header">
        <span className="shell-brand">Habit Shaper</span>
        <nav className="shell-nav">
          <Link to="/" className="btn-ghost">
            Dashboard
          </Link>
          <span className="btn-ghost shell-nav-current">Goals</span>
        </nav>
        <button type="button" className="btn-ghost" onClick={handleLogout}>
          Logout
        </button>
      </header>
      <main className="shell-main">
        <h1>Goals</h1>
        {pageError && (
          <p role="alert" className="form-error">
            {pageError}
          </p>
        )}
        {notice && <p className="form-notice">{notice}</p>}

        {habits.length === 0 ? (
          <section className="create-section">
            <p className="empty">
              You need a habit before you can create a goal — every goal links to one habit.{" "}
              <Link to="/">Create a habit on the dashboard</Link>.
            </p>
          </section>
        ) : (
          <section className="create-section">
            <h2>Create a goal</h2>
            <form onSubmit={handleCreate} className="create-form">
              <div className="field">
                <label htmlFor="goal-title">Title</label>
                <input
                  id="goal-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="goal-desc">Description (optional)</label>
                <textarea
                  id="goal-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={1000}
                  rows={3}
                />
              </div>
              <div className="field">
                <label htmlFor="goal-habit">Linked habit</label>
                <select
                  id="goal-habit"
                  value={habitId}
                  onChange={(e) => setHabitId(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                >
                  <option value="" disabled>
                    Select a habit…
                  </option>
                  {habits.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} — {h.type}
                    </option>
                  ))}
                </select>
              </div>
              {createError && (
                <p role="alert" className="form-error">
                  {createError}
                </p>
              )}
              <button type="submit" className="btn-primary" disabled={creating}>
                {creating ? "Creating…" : "Create goal"}
              </button>
            </form>
          </section>
        )}

        <section>
          <h2>Your goals</h2>
          {goals.length === 0 ? (
            <p className="empty">No goals yet.</p>
          ) : (
            <ul className="goal-list">
              {goals.map((g) =>
                editingId === g.id ? (
                  <li key={g.id} className="goal-card">
                    <form onSubmit={handleSaveEdit} className="create-form">
                      <div className="field">
                        <label htmlFor={`goal-edit-title-${g.id}`}>Title</label>
                        <input
                          id={`goal-edit-title-${g.id}`}
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          maxLength={200}
                          required
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`goal-edit-desc-${g.id}`}>Description</label>
                        <textarea
                          id={`goal-edit-desc-${g.id}`}
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          maxLength={1000}
                          rows={3}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`goal-edit-habit-${g.id}`}>Linked habit</label>
                        <select
                          id={`goal-edit-habit-${g.id}`}
                          value={editHabitId}
                          onChange={(e) => setEditHabitId(e.target.value === "" ? "" : Number(e.target.value))}
                          required
                        >
                          {habits.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.name} — {h.type}
                            </option>
                          ))}
                        </select>
                      </div>
                      {editError && (
                        <p role="alert" className="form-error">
                          {editError}
                        </p>
                      )}
                      <div className="goal-actions">
                        <button type="submit" className="btn-primary btn-small" disabled={savingEdit}>
                          {savingEdit ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn-small"
                          disabled={savingEdit}
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </li>
                ) : (
                  <li key={g.id} className="goal-card">
                    <div className="goal-info">
                      <span className="goal-title">{g.title}</span>
                      <span className="goal-habit">
                        <span className={`badge badge-${g.habit.type.toLowerCase()}`}>{g.habit.type}</span>{" "}
                        {g.habit.name}
                      </span>
                      {g.description && <span className="goal-desc">{g.description}</span>}
                    </div>
                    <div className="goal-actions">
                      <button
                        type="button"
                        className="btn-ghost btn-small"
                        disabled={deletingId === g.id}
                        onClick={() => startEdit(g)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-danger btn-small"
                        disabled={deletingId === g.id}
                        onClick={() => void handleDelete(g)}
                      >
                        {deletingId === g.id ? "…" : "Delete"}
                      </button>
                    </div>
                  </li>
                ),
              )}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
