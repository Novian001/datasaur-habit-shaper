import { Router } from "express";
import { habitSchema } from "../lib/validation.js";
import { requireAuth } from "../middleware/auth.js";
import { notFound } from "../lib/errors.js";
import { createHabit, listHabits, getOwnedHabit, toSafeHabit } from "../services/habits.js";

export const habitsRouter = Router();

// All habit routes require auth; ownership = req.userId (never client-supplied).
habitsRouter.use(requireAuth);

// POST /api/habits — 201 { habit }; 400 invalid; 401.
habitsRouter.post("/", async (req, res) => {
  const input = habitSchema.parse(req.body);
  const habit = await createHabit(req.userId!, input);
  res.status(201).json({ habit: toSafeHabit(habit) });
});

// GET /api/habits — 200 { habits: [...] } (contract shape); 401.
// Phase 4: no stats/refDate yet (Phase 5). Deterministic order: newest first.
habitsRouter.get("/", async (req, res) => {
  const habits = await listHabits(req.userId!);
  res.json({ habits: habits.map(toSafeHabit) });
});

// GET /api/habits/:id — 200 { habit }; 404 not found OR not owned (D7, no 403).
habitsRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw notFound("Habit not found");
  const habit = await getOwnedHabit(req.userId!, id);
  if (!habit) throw notFound("Habit not found");
  res.json({ habit: toSafeHabit(habit) });
});
