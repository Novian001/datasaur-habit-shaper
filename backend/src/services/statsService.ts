// Habit statistics assembly (Phase 5B). Pure calendar math from
// src/services/stats.ts applied to the event rows owned by the caller.
// Ownership is proven by the caller BEFORE any stat is computed (D7).

import { prisma } from "../lib/prisma.js";
import { badRequest } from "../lib/errors.js";
import { isValidDateString } from "../lib/dates.js";
import { getOwnedHabit } from "./habits.js";
import { currentStreak, weeklyStats, cleanStreak } from "./stats.js";

// The one stats entry point. Ownership check first (foreign/nonexistent →
// null → caller 404); only then are rows read and stats derived.
// refDate: client-supplied local calendar "today" (D8) — required, validated.
export async function getHabitStats(userId: number, habitId: number, refDate: string) {
  if (!isValidDateString(refDate)) {
    throw badRequest("refDate must be a valid calendar date in YYYY-MM-DD format");
  }
  const habit = await getOwnedHabit(userId, habitId);
  if (!habit) return null;

  const startDate = habit.startDate.toISOString().slice(0, 10);
  // refDate is a calendar date; startDate is the business boundary (D8).
  // A refDate before the habit started is meaningless — reject before any
  // derivation (data-model.md §4: startDate is the lower calendar boundary).
  if (refDate < startDate) {
    throw badRequest("refDate cannot be before the habit startDate");
  }

  if (habit.type === "BUILD") {
    const rows = await prisma.habitCompletion.findMany({
      where: { habitId },
      select: { date: true },
      orderBy: { date: "asc" },
    });
    const dates = rows.map((r) => r.date.toISOString().slice(0, 10));
    const streak = currentStreak(startDate, refDate, dates);
    const week = weeklyStats(startDate, refDate, dates);
    return {
      stats: {
        currentStreak: streak,
        weekCompleted: week.weekCompleted,
        weekElapsedDays: week.weekElapsedDays,
        weekCompletionRate: week.weekCompletionRate,
        missedDays: week.missedDays,
      },
      // Contract §2 detail: BUILD history dates (for the UI calendar strip).
      completedDates: [...dates].reverse(),
    };
  }

  const rows = await prisma.relapseEvent.findMany({
    where: { habitId },
    select: { relapseDate: true },
    orderBy: { relapseDate: "asc" },
  });
  const dates = rows.map((r) => r.relapseDate.toISOString().slice(0, 10));
  const clean = cleanStreak(startDate, refDate, dates);
  return {
    stats: {
      cleanStreak: clean.cleanStreak,
      lastRelapseDate: clean.lastRelapseDate,
    },
    relapseDates: [...dates].reverse(),
  };
}
