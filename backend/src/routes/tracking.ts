import { Router } from "express";
import { dateSchema, relapseSchema } from "../lib/validation.js";
import { requireAuth } from "../middleware/auth.js";
import { notFound } from "../lib/errors.js";
import { markCompletion, removeCompletion, recordRelapse } from "../services/tracking.js";

export const trackingRouter = Router();

// All tracking mutations require auth; ownership = req.userId (never client).
trackingRouter.use(requireAuth);

// Shared: validate :id, reject malformed ids as 404 (foreign/nonexistent → 404).
function habitIdParam(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw notFound("Habit not found");
  return id;
}

// PUT /api/habits/:id/completions — 201 first / 200 repeat (idempotent, D2);
// 400 invalid date/type/future/pre-creation; 401; 404 foreign/nonexistent.
// Body { date, refDate } — refDate is the client's local calendar "today"
// (D8; no server clock — human-review correction 2026-08-12).
trackingRouter.put("/habits/:id/completions", async (req, res) => {
  const habitId = habitIdParam(req.params.id);
  const { date, refDate } = dateSchema.parse(req.body);
  const result = await markCompletion(req.userId!, habitId, date, refDate);
  if (result.status === 404) throw notFound("Habit not found");
  const d = result.completion.date.toISOString().slice(0, 10);
  res.status(result.status).json({ completion: { id: result.completion.id, habitId, date: d } });
});

// DELETE /api/habits/:id/completions/:date — 204 (idempotent, ED); 400 invalid
// date/type; 401; 404 foreign/nonexistent habit.
trackingRouter.delete("/habits/:id/completions/:date", async (req, res) => {
  const habitId = habitIdParam(req.params.id);
  const result = await removeCompletion(req.userId!, habitId, req.params.date);
  if (result.status === 404) throw notFound("Habit not found");
  res.status(204).end();
});

// POST /api/habits/:id/relapses — 201 first / 200 repeat (idempotent, D5);
// 400 invalid date/type/future/pre-creation; 401; 404 foreign/nonexistent.
// Body { relapseDate, refDate } — refDate is the client's local calendar
// "today" (D8; no server clock — human-review correction 2026-08-12).
trackingRouter.post("/habits/:id/relapses", async (req, res) => {
  const habitId = habitIdParam(req.params.id);
  const { relapseDate, refDate } = relapseSchema.parse(req.body);
  const result = await recordRelapse(req.userId!, habitId, relapseDate, refDate);
  if (result.status === 404) throw notFound("Habit not found");
  const d = result.relapse.relapseDate.toISOString().slice(0, 10);
  res.status(result.status).json({ relapse: { id: result.relapse.id, habitId, relapseDate: d } });
});
