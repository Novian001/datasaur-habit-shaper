import { Router } from "express";
import { habitSchema } from "../lib/validation.js";
import { isValidDateString } from "../lib/dates.js";
import { badRequest, notFound } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { createHabit, listHabits, getOwnedHabit, toSafeHabit } from "../services/habits.js";
import { getHabitStats } from "../services/statsService.js";

export const habitsRouter = Router();

// All habit routes require auth; ownership = req.userId (never client-supplied).
habitsRouter.use(requireAuth);

// refDate (D8): the client's local calendar "today" — the reference date for
// every stat. Required on the GET routes (no server-clock fallback); validity
// is enforced inside getHabitStats. Shared by both GET handlers below.
function refDateQuery(req: { query: Record<string, unknown> }): string {
  const refDate = req.query.refDate;
  if (typeof refDate !== "string" || refDate.length === 0) {
    throw badRequest("refDate query parameter is required");
  }
  return refDate;
}

// POST /api/habits — 201 { habit }; 400 invalid; 401.
habitsRouter.post("/", async (req, res) => {
  const input = habitSchema.parse(req.body);
  if (!isValidDateString(input.startDate)) {
    throw badRequest("startDate must be a valid calendar date in YYYY-MM-DD format");
  }
  const habit = await createHabit(req.userId!, input);
  res.status(201).json({ habit: toSafeHabit(habit) });
});

// GET /api/habits?refDate=YYYY-MM-DD — 200 { habits: [...] } each with
// computed stats (contract §2: BUILD → streak/week fields, BREAK →
// cleanStreak/lastRelapseDate); 400 missing/invalid refDate; 401.
habitsRouter.get("/", async (req, res) => {
  const refDate = refDateQuery(req);
  const habits = await listHabits(req.userId!);
  const items = await Promise.all(
    habits.map(async (habit) => ({
      ...toSafeHabit(habit),
      stats: (await getHabitStats(req.userId!, habit.id, refDate))!.stats,
    })),
  );
  res.json({ habits: items });
});

// GET /api/habits/:id?refDate=YYYY-MM-DD — 200 { habit, stats, history };
// 404 not found OR not owned (D7, no 403); 400 missing/invalid refDate;
// 400 refDate before startDate.
habitsRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw notFound("Habit not found");
  const refDate = refDateQuery(req);
  const habit = await getOwnedHabit(req.userId!, id);
  if (!habit) throw notFound("Habit not found");
  const result = await getHabitStats(req.userId!, id, refDate);
  if (!result) throw notFound("Habit not found");
  res.json({ habit: toSafeHabit(habit), ...result });
});
