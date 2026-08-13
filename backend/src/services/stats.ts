// Derived habit statistics (Phase 5B). Source of truth: docs/data-model.md §4.
// Every function is pure: given habit.startDate, the client-supplied refDate,
// and the event rows, it returns the same answer every time. No function here
// reads a clock, a timezone, or process state (D8) — "today" is always the
// explicit refDate string.

import { mondayOfWeek, shiftDate } from "../lib/dates.js";

// Calendar-day diff: b - a in whole days, both naive YYYY-MM-DD (a <= b).
// Pure arithmetic on UTC day numbers — a calendar index, never a time
// instant (no clock, no DST, no timezone).
function dayDiff(a: string, b: string): number {
  const ms = (x: string) => Date.UTC(Number(x.slice(0, 4)), Number(x.slice(5, 7)) - 1, Number(x.slice(8, 10)));
  return Math.round((ms(b) - ms(a)) / 86_400_000);
}

// BUILD current streak (D1): consecutive completed calendar days ending at
// refDate (if completed) or at the day before refDate (refDate still in
// progress). An unfinished refDate never breaks yesterday's streak; a missed
// PAST day breaks it. Dates before startDate are never inspected.
export function currentStreak(startDate: string, refDate: string, completedDates: readonly string[]): number {
  const completed = new Set(completedDates);
  // Skip the in-progress refDate if not completed, then walk backward.
  let cursor = completed.has(refDate) ? refDate : shiftDate(refDate, -1);
  let streak = 0;
  while (cursor >= startDate) {
    if (!completed.has(cursor)) break;
    streak++;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

// BUILD weekly statistics (D3): Monday..Sunday week containing refDate.
// Eligible range = [max(weekMonday, startDate), refDate] — future days later
// in the week and days before startDate are never counted.
export function weeklyStats(startDate: string, refDate: string, completedDates: readonly string[]): {
  weekCompleted: number;
  weekElapsedDays: number;
  weekCompletionRate: number;
  missedDays: number;
} {
  // Future-start habit: startDate after refDate → no days eligible yet.
  if (startDate > refDate) {
    return { weekCompleted: 0, weekElapsedDays: 0, weekCompletionRate: 0, missedDays: 0 };
  }
  const lower = mondayOfWeek(refDate) > startDate ? mondayOfWeek(refDate) : startDate;
  const eligible = dayDiff(lower, refDate) + 1;
  const completed = completedDates.filter((d) => d >= lower && d <= refDate).length;
  return {
    weekCompleted: completed,
    weekElapsedDays: eligible,
    weekCompletionRate: eligible === 0 ? 0 : completed / eligible,
    missedDays: eligible - completed,
  };
}

// BREAK clean streak (D4, D5): days since the most recent relapse <= refDate.
// No relapse → days between startDate and refDate INCLUSIVE (startDate is
// Day 1, data-model.md §4). Relapse day → 0; Day 1 restarts the next calendar
// day. Relapse dates after refDate are ignored. startDate is the floor.
export function cleanStreak(
  startDate: string,
  refDate: string,
  relapseDates: readonly string[],
): { cleanStreak: number; lastRelapseDate: string | null } {
  let lastRelapse: string | null = null;
  for (const r of relapseDates) {
    // startDate is the floor: a relapse before the habit started is
    // meaningless history, never a streak reset (D5, data-model.md §4).
    if (r < startDate) continue;
    if (r <= refDate && (lastRelapse === null || r > lastRelapse)) lastRelapse = r;
  }
  if (lastRelapse === null) {
    // No relapse yet: inclusive streak from the day the habit started (D5).
    return { cleanStreak: Math.max(0, dayDiff(startDate, refDate) + 1), lastRelapseDate: null };
  }
  // Relapse day itself is 0 (D5); Day 1 is the next calendar day.
  return { cleanStreak: Math.max(0, dayDiff(lastRelapse, refDate)), lastRelapseDate: lastRelapse };
}
