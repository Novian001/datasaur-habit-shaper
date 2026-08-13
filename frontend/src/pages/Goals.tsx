import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth, errorMessage } from "../context/AuthContext";
import { listHabits, type Habit } from "../api/habits";
import { listGoals, createGoal, updateGoal, deleteGoal, type Goal } from "../api/goals";
import AppHeader, { CheckIcon, AlertIcon, EditIcon, TrashIcon, TargetIcon } from "../components/AppHeader";

// Goals page (contract §5): list, create, inline edit (title/description/
// relink), delete. Habit selector is populated from the authenticated user's
// own habits only (ownership enforced backend-side, D7). Goals UI is Phase 9;
// no deadlines/progress/priority — the model is minimal by design (D6).
export default function GoalsPage() {
  const { token } = useAuth();
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
    return (
      <div className="shell">
        <AppHeader />
        <main className="shell-main">
          <div className="page-loading">Loading goals…</div>
        </main>
      </div>
    );
  }

  return (
    <div className="shell">
      <AppHeader />
      <main className="shell-main">
        <div className="page-intro">
          <h1>Goals</h1>
          <p>Keep your habits connected to meaningful outcomes.</p>
        </div>

        {pageError && (
          <p role="alert" className="alert alert-error">
            <AlertIcon size={16} />
            <span>{pageError}</span>
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
            <h3>Create a habit before adding a goal</h3>
            <p>Every goal links to one of your habits, so start there.</p>
            <Link to="/" className="btn btn-primary">
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <section className="create-section">
            <h2>Create a goal</h2>
            <p className="section-sub">Link your intention to a habit you&apos;re already shaping.</p>
            <form onSubmit={handleCreate} className="card create-panel">
              <div className="field">
                <label htmlFor="goal-title">Title</label>
                <input
                  id="goal-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Meditate daily for a calmer mind"
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
                <p role="alert" className="alert alert-error">
                  <AlertIcon size={16} />
                  <span>{createError}</span>
                </p>
              )}
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? "Creating…" : "Create goal"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="section-block">
          <div className="section-head">
            <h2>Your goals</h2>
            <span className="section-sub">
              {goals.length} {goals.length === 1 ? "goal" : "goals"}
            </span>
          </div>
          {goals.length === 0 ? (
            <div className="empty-state">
              <TargetIcon size={36} />
              <h3>No goals yet</h3>
              <p>Connect a goal to one of your habits to keep your intention visible.</p>
            </div>
          ) : (
            <ul className="goal-list">
              {goals.map((g) =>
                editingId === g.id ? (
                  <li key={g.id} className="card goal-card">
                    <form onSubmit={handleSaveEdit} className="goal-edit-form">
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
                        <p role="alert" className="alert alert-error">
                          <AlertIcon size={16} />
                          <span>{editError}</span>
                        </p>
                      )}
                      <div className="goal-actions">
                        <button type="submit" className="btn btn-primary btn-sm" disabled={savingEdit}>
                          {savingEdit ? "Saving…" : "Save"}
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={savingEdit} onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  </li>
                ) : (
                  <li key={g.id} className="card goal-card">
                    <div className="goal-info">
                      <span className="goal-title">{g.title}</span>
                      <span className="goal-habit">
                        <span className={`badge badge-${g.habit.type.toLowerCase()}`}>{g.habit.type}</span>
                        {g.habit.name}
                      </span>
                      {g.description && <span className="goal-desc">{g.description}</span>}
                    </div>
                    <div className="goal-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={deletingId === g.id}
                        onClick={() => startEdit(g)}
                      >
                        <EditIcon size={14} /> Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-destructive-ghost btn-sm"
                        disabled={deletingId === g.id}
                        onClick={() => void handleDelete(g)}
                      >
                        <TrashIcon size={14} /> {deletingId === g.id ? "Deleting…" : "Delete"}
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
