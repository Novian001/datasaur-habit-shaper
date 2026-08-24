// Derived statistics for TIMES_PER_WEEK BUILD habits (S4–S6).
// Pure: given startDate, refDate, completed date set, and weeklyTarget,
// returns the same answer every time. No clock, no timezone, no side effects.
//
// Weekly period = Monday..Sunday (D3). A week is "complete" when its
// Sunday <= refDate. The current week is "in-progress" when refDate <
// its Sunday — it has not failed yet.
//
// First partial week rule (S6):
//   If availableDaysInFirstWeek >= weeklyTarget → first week IS streak-
//   eligible with the FULL target.
//   If availableDaysInFirstWeek < weeklyTarget → first partial week is
//   NEUTRAL. It does NOT: increase streak, reset streak, or count as failed.
//   Streak evaluation begins the following Monday.
//
// Weekly streak rule (S5):
//   A completed week is "successful" when completions >= weeklyTarget.
//   The displayed weeklyStreak counts consecutive successful completed weeks.
//   The current in-progress week does NOT contribute to the count until it
//   is complete (or until it reaches its target early, at which point it
//   counts immediately). A closed current week below target BREAKS the
//   streak — UNLESS that closed week is the first partial week that was
//   marked neutral.

import { mondayOfWeek, sundayOfWeek, shiftDate } from "../lib/dates.js";

function lastDayOfWeek(date: string): string {
  return sundayOfWeek(date);
}

// Build a map: weekMonday → completion count for all completions in range.
function buildWeekMap(completedDates: readonly string[], startDate: string, refDate: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const d of completedDates) {
    if (d < startDate || d > refDate) continue;
    const wm = mondayOfWeek(d);
    map.set(wm, (map.get(wm) ?? 0) + 1);
  }
  return map;
}

// Count of calendar days from startDate through the Sunday of the week
// containing startDate, inclusive.
function daysInFirstWeek(startDate: string): number {
  const firstSunday = lastDayOfWeek(startDate);
  // Number of days between startDate and firstSunday inclusive:
  // shiftDate works on UTC day boundaries.
  const start = Date.UTC(Number(startDate.slice(0,4)), Number(startDate.slice(5,7))-1, Number(startDate.slice(8,10)));
  const end   = Date.UTC(Number(firstSunday.slice(0,4)), Number(firstSunday.slice(5,7))-1, Number(firstSunday.slice(8,10)));
  return Math.floor((end - start) / 86_400_000) + 1;
}

// TIMES_PER_WEEK weekly stats (S11).
export function weeklyTargetStats(
  startDate: string,
  refDate: string,
  completedDates: readonly string[],
  weeklyTarget: number,
): {
  weeklyTarget: number;
  weeklyCompleted: number;
  weeklyRemaining: number;
  weeklyGoalReached: boolean;
  weeklyCompletionRate: number;
} {
  if (startDate > refDate) {
    return { weeklyTarget, weeklyCompleted: 0, weeklyRemaining: weeklyTarget, weeklyGoalReached: false, weeklyCompletionRate: 0 };
  }

  const weekMap = buildWeekMap(completedDates, startDate, refDate);
  const currentWeekMonday = mondayOfWeek(refDate);
  const completed = weekMap.get(currentWeekMonday) ?? 0;

  return {
    weeklyTarget,
    weeklyCompleted: completed,
    weeklyRemaining: Math.max(0, weeklyTarget - completed),
    weeklyGoalReached: completed >= weeklyTarget,
    weeklyCompletionRate: Math.min(completed / weeklyTarget, 1.0),
  };
}

// TIMES_PER_WEEK weekly streak (S4–S6).
// Returns: weeklyStreak (consecutive successful completed weeks), plus
// metadata about the current week for callers that need it.
export function weeklyStreakTPW(
  startDate: string,
  refDate: string,
  completedDates: readonly string[],
  weeklyTarget: number,
): {
  weeklyStreak: number;
  currentWeekSuccessful: boolean;
  currentWeekComplete: boolean;
  currentWeekFailed: boolean;
} {
  if (startDate > refDate) {
    return { weeklyStreak: 0, currentWeekSuccessful: false, currentWeekComplete: false, currentWeekFailed: false };
  }

  const weekMap = buildWeekMap(completedDates, startDate, refDate);
  const currentWeekMonday = mondayOfWeek(refDate);
  const currentWeekLastDay = lastDayOfWeek(refDate);
  const currentCompleted = weekMap.get(currentWeekMonday) ?? 0;
  const currentWeekComplete = currentWeekLastDay <= refDate;

  // First partial week eligibility (S6).
  const daysAvailable = daysInFirstWeek(startDate);
  const firstWeekEligible = daysAvailable >= weeklyTarget;
  const firstWeekMonday = mondayOfWeek(startDate);
  // First streak-eligible week: the first eligible week in the Monday-Sun
  // cycle. If first week is not eligible, skip to the next Monday.
  const cursor = firstWeekEligible ? firstWeekMonday : shiftDate(firstWeekMonday, 7);
  // `firstWeekNeutral` is true when the first partial week existed but was
  // not streak-eligible (S6): it does not count as a failure.
  const firstWeekNeutral = !firstWeekEligible;

  // Walk backward through completed weeks (those with Sunday <= refDate).
  let streak = 0;
  let prevWeek = shiftDate(currentWeekMonday, -7);
  let prevWeekSunday = lastDayOfWeek(prevWeek);

  while (prevWeekSunday <= refDate) {
    // Skip weeks before the first streak-eligible week.
    if (prevWeek < cursor) break;
    const count = weekMap.get(prevWeek) ?? 0;
    if (count >= weeklyTarget) {
      streak++;
      prevWeek = shiftDate(prevWeek, -7);
      prevWeekSunday = lastDayOfWeek(prevWeek);
    } else {
      break;
    }
  }

  // Evaluate the current week (the week containing refDate).
  if (currentWeekComplete) {
    if (currentCompleted >= weeklyTarget) {
      return { weeklyStreak: streak + 1, currentWeekSuccessful: true, currentWeekComplete: true, currentWeekFailed: false };
    } else {
      // Current week is closed and below target — streak breaks UNLESS
      // this closed week is the first partial week that was neutral (S6).
      const streakBreaks = !firstWeekNeutral;
      return { weeklyStreak: streakBreaks ? 0 : streak, currentWeekSuccessful: false, currentWeekComplete: true, currentWeekFailed: streakBreaks };
    }
  } else {
    // Current week is in-progress: if already at/above target, count it.
    if (currentCompleted >= weeklyTarget) {
      return { weeklyStreak: streak + 1, currentWeekSuccessful: true, currentWeekComplete: false, currentWeekFailed: false };
    }
    // In-progress and below target — preserve previous streak (S5).
    return { weeklyStreak: streak, currentWeekSuccessful: false, currentWeekComplete: false, currentWeekFailed: false };
  }
}