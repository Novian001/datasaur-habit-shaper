import { prisma } from "../lib/prisma.js";
import { notFound, badRequest } from "../lib/errors.js";
import { isValidDateString } from "../lib/dates.js";
import { getOwnedHabit } from "./habits.js";

// Validate a calendar date against the approved write policy
// (api-contract.md §3/§4): real YYYY-MM-DD, not after the client's refDate,
// not before the habit's startDate. Pure string comparison (D8) — no server
// clock, no UTC conversion (human-review correction 2026-08-12).
function assertWritableDate(date: string, refDate: string, startDate: string) {
  if (!isValidDateString(date)) {
    throw badRequest("Date must be a valid calendar date in YYYY-MM-DD format");
  }
  if (!isValidDateString(refDate)) {
    throw badRequest("refDate must be a valid calendar date in YYYY-MM-DD format");
  }
  if (date > refDate) {
    throw badRequest("Date cannot be in the future");
  }
  if (date < startDate) {
    throw badRequest("Date cannot be before the habit was created");
  }
}

// Shared ownership+type guard: owned habit → habit; foreign/nonexistent → 404;
// wrong type → 400 INVALID_HABIT_TYPE (api-contract.md §3/§4).
export async function findOwnedHabitForTracking(userId: number, id: number, expectedType: "BUILD" | "BREAK") {
  const habit = await getOwnedHabit(userId, id);
  if (!habit) return null;
  // Type check BEFORE date policy so a wrong-type attempt yields
  // INVALID_HABIT_TYPE, not a misleading date error.
  if (habit.type !== expectedType) {
    // Domain validation error (api-contract.md §3/§4 INVALID_HABIT_TYPE, 400).
    throw badRequest("Habit type does not support this action", "INVALID_HABIT_TYPE");
  }
  return habit;
}

export async function markCompletion(userId: number, habitId: number, date: string, refDate: string) {
  const habit = await findOwnedHabitForTracking(userId, habitId, "BUILD");
  if (!habit) return { status: 404 as const };

  // Date policy is validated against the client refDate + habit startDate even
  // on repeat (contract). habit.startDate is the client-supplied local
  // calendar boundary (D8) — never derived from the createdAt timestamp.
  assertWritableDate(date, refDate, habit.startDate.toISOString().slice(0, 10));

  const dateObj = new Date(date + "T00:00:00.000Z");
  try {
    const completion = await prisma.habitCompletion.create({ data: { habitId, date: dateObj } });
    return { status: 201 as const, completion };
  } catch (err) {
    // UNIQUE(habit_id, date) (D2): identical repeat → 200 with the existing
    // row. No duplicate row, no state change, no 409. Race-free — the unique
    // constraint is the arbiter, not a check-then-create window.
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      const completion = await prisma.habitCompletion.findUniqueOrThrow({
        where: { habitId_date: { habitId, date: dateObj } },
      });
      return { status: 200 as const, completion };
    }
    throw err;
  }
}

export async function removeCompletion(userId: number, habitId: number, date: string) {
  const habit = await findOwnedHabitForTracking(userId, habitId, "BUILD");
  if (!habit) return { status: 404 as const };

  // The DELETE contract (§3) only requires a well-formed calendar date; it does
  // not list the future/pre-creation restrictions of the PUT.
  if (!isValidDateString(date)) {
    throw badRequest("Date must be a valid calendar date in YYYY-MM-DD format");
  }

  // Idempotent delete (ED): absent row → 204, same as present row. Absence of a
  // completion row must not disclose habit existence (D7) — ownership was
  // already enforced above.
  await prisma.habitCompletion.deleteMany({ where: { habitId, date: new Date(date + "T00:00:00.000Z") } });
  return { status: 204 as const };
}

export async function recordRelapse(userId: number, habitId: number, date: string, refDate: string) {
  const habit = await findOwnedHabitForTracking(userId, habitId, "BREAK");
  if (!habit) return { status: 404 as const };

  assertWritableDate(date, refDate, habit.startDate.toISOString().slice(0, 10));

  const dateObj = new Date(date + "T00:00:00.000Z");
  try {
    const relapse = await prisma.relapseEvent.create({ data: { habitId, relapseDate: dateObj } });
    return { status: 201 as const, relapse };
  } catch (err) {
    // UNIQUE(habit_id, relapse_date) (D5, contract §4): identical repeat →
    // 200 with the existing row. No duplicate, no 409. Race-free — the unique
    // constraint is the arbiter, not a check-then-create window.
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      const relapse = await prisma.relapseEvent.findUniqueOrThrow({
        where: { habitId_relapseDate: { habitId, relapseDate: dateObj } },
      });
      return { status: 200 as const, relapse };
    }
    throw err;
  }
}
