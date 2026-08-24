// Habit statistics assembly (Phase 5B + frequency extension). Pure calendar
// math from src/services/stats.ts and src/services/statsTPW.ts applied to the
// event rows owned by the caller. Ownership is proven by the caller BEFORE any
// stat is computed (D7).
//
// For DAILY BUILD habits: currentStreak + weekly calendar-day stats (S11).
// For TIMES_PER_WEEK BUILD habits: weeklyStreak + target-based stats (S4-S6).
// For BREAK habits: cleanStreak only (frequencyType is ignored for BREAK).
//
// Stats are ALWAYS derived from event rows — no stored mutable counters.

import { prisma } from "../lib/prisma.js";
import { badRequest } from "../lib/errors.js";
import { isValidDateString } from "../lib/dates.js";
import { getOwnedHabit } from "./habits.js";
import { currentStreak, weeklyStats, cleanStreak } from "./stats.js";
import { weeklyTargetStats, weeklyStreakTPW } from "./statsTPW.js";

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

  // A refDate before startDate means the habit hasn't started yet (future
  // startDate): the pure stats functions below already clamp everything to 0
  // and never count pre-start days, so no validation error is raised here.
  // Pre-start tracking is still rejected by the tracking service.

  if (habit.type === "BUILD" && habit.frequencyType === "TIMES_PER_WEEK") {
    const rows = await prisma.habitCompletion.findMany({
      where: { habitId },
      select: { date: true },
      orderBy: { date: "asc" },
    });
    const dates = rows.map((r) => r.date.toISOString().slice(0, 10));
    const weeklyTarget = habit.weeklyTarget ?? 3;
    const tpw = weeklyTargetStats(startDate, refDate, dates, weeklyTarget);
    const streak = weeklyStreakTPW(startDate, refDate, dates, weeklyTarget);

    return {
      stats: {
        // Additive fields for TIMES_PER_WEEK (S11):
        weeklyStreak: streak.weeklyStreak,
        weeklyTarget: tpw.weeklyTarget,
        weeklyCompleted: tpw.weeklyCompleted,
        weeklyRemaining: tpw.weeklyRemaining,
        weeklyGoalReached: tpw.weeklyGoalReached,
        weeklyCompletionRate: tpw.weeklyCompletionRate,
      },
      // contract: BUILD history dates (for the UI calendar strip).
      completedDates: [...dates].reverse(),
    };
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