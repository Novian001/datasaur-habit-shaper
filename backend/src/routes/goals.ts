import { Router } from "express";
import { goalCreateSchema, goalUpdateSchema } from "../lib/validation.js";
import { requireAuth } from "../middleware/auth.js";
import { notFound } from "../lib/errors.js";
import { createGoal, listGoals, updateGoal, deleteGoal, toSafeGoal } from "../services/goals.js";

export const goalsRouter = Router();

// All goal routes require auth; ownership = req.userId (never client).
goalsRouter.use(requireAuth);

// Shared: validate :id, reject malformed ids as 404 (foreign/nonexistent → 404).
function goalIdParam(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw notFound("Goal not found");
  return id;
}

// GET /api/goals — 200 { goals: [...] } (current user only, contract §5);
// 401.
goalsRouter.get("/", async (req, res) => {
  const goals = await listGoals(req.userId!);
  res.json({ goals: goals.map(toSafeGoal) });
});

// POST /api/goals — 201 { goal } with embedded habit; 400 invalid; 401;
// 404 foreign/nonexistent habit (D7).
goalsRouter.post("/", async (req, res) => {
  const input = goalCreateSchema.parse(req.body);
  const result = await createGoal(req.userId!, input);
  if (!result) throw notFound("Habit not found");
  res.status(201).json({ goal: toSafeGoal({ ...result.goal, habit: result.habit }) });
});

// PATCH /api/goals/:id — 200 { goal }; 400 invalid; 401;
// 404 foreign/nonexistent goal OR foreign/nonexistent relink target (D7).
goalsRouter.patch("/:id", async (req, res) => {
  const id = goalIdParam(req.params.id);
  const input = goalUpdateSchema.parse(req.body);
  const goal = await updateGoal(req.userId!, id, input);
  if (!goal) throw notFound("Goal not found");
  res.json({ goal: toSafeGoal(goal) });
});

// DELETE /api/goals/:id — 204; 401; 404 foreign/nonexistent goal.
// Deletes ONLY the goal row; the linked habit is untouched.
goalsRouter.delete("/:id", async (req, res) => {
  const id = goalIdParam(req.params.id);
  const deleted = await deleteGoal(req.userId!, id);
  if (!deleted) throw notFound("Goal not found");
  res.status(204).end();
});
