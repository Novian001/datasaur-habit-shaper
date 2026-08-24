// TIMES_PER_WEEK pure-function tests (S4–S6).
// All tests use fixed calendar dates — no server-clock dependency.
// Reference week: 2026-08-17 (Mon) – 2026-08-23 (Sun).

import { describe, it, expect } from "vitest";
import { weeklyTargetStats, weeklyStreakTPW } from "../src/services/statsTPW.js";

// Shared helpers.
const REF = "2026-08-22"; // Saturday — current week is NOT yet closed (Sun = Aug 23)

function noDates(): string[] { return []; }
function only(...dates: string[]): string[] { return dates; }

function stats(startDate: string, refDate: string, completedDates: readonly string[], target: number) {
  return weeklyTargetStats(startDate, refDate, completedDates, target);
}
function streak(startDate: string, refDate: string, completedDates: readonly string[], target: number) {
  return weeklyStreakTPW(startDate, refDate, completedDates, target);
}

// ─────────────────────────────────────────────────────────────────────────────
// weeklyTargetStats
// ─────────────────────────────────────────────────────────────────────────────

describe("weeklyTargetStats", () => {

  it("1. target 3: Tue+Thu+Sat → goal reached, rate 100%", () => {
    const s = stats("2026-08-17", REF, only("2026-08-18","2026-08-20","2026-08-22"), 3);
    expect(s.weeklyGoalReached).toBe(true);
    expect(s.weeklyCompleted).toBe(3);
    expect(s.weeklyRemaining).toBe(0);
    expect(s.weeklyCompletionRate).toBe(1.0);
  });

  it("2. Mon+Tue+Fri → goal reached", () => {
    const s = stats("2026-08-17", REF, only("2026-08-17","2026-08-18","2026-08-21"), 3);
    expect(s.weeklyGoalReached).toBe(true);
    expect(s.weeklyCompleted).toBe(3);
  });

  it("3. Fri+Sat+Sun → goal reached", () => {
    // refDate = Aug 23 (Sunday, so the week is fully closed).
    const s = stats("2026-08-17", "2026-08-23", only("2026-08-21","2026-08-22","2026-08-23"), 3);
    expect(s.weeklyGoalReached).toBe(true);
    expect(s.weeklyCompleted).toBe(3);
  });

  it("7. 4/3 → weeklyGoalReached true, rate capped 1.0", () => {
    const s = stats("2026-08-17", REF, only("2026-08-17","2026-08-18","2026-08-19","2026-08-20"), 3);
    expect(s.weeklyGoalReached).toBe(true);
    expect(s.weeklyCompleted).toBe(4);
    expect(s.weeklyCompletionRate).toBe(1.0);
    expect(s.weeklyRemaining).toBe(0);
  });

  it("8. 2/3 → remaining 1", () => {
    const s = stats("2026-08-17", REF, only("2026-08-17","2026-08-18"), 3);
    expect(s.weeklyGoalReached).toBe(false);
    expect(s.weeklyCompleted).toBe(2);
    expect(s.weeklyRemaining).toBe(1);
  });

  it("14. future start → all zeros", () => {
    const s = stats("2026-08-25", REF, noDates(), 3);
    expect(s.weeklyGoalReached).toBe(false);
    expect(s.weeklyCompleted).toBe(0);
    expect(s.weeklyRemaining).toBe(3);
    expect(s.weeklyCompletionRate).toBe(0);
  });

  it("rate capped at 1.0 for >100% completion", () => {
    const s = stats("2026-08-17", REF, only("2026-08-17","2026-08-18","2026-08-19","2026-08-20","2026-08-21","2026-08-22"), 3);
    expect(s.weeklyCompletionRate).toBe(1.0);
  });

  it("first week partial: start Wed, target 3, Mon+Wed+Thu in first week", () => {
    // Aug 19 (Wed) start. First week: Aug 19–23 (5 days, eligible).
    // Completions in first week: Aug 19, 21, 22 → 3/3.
    const s = stats("2026-08-19", "2026-08-22", only("2026-08-19","2026-08-21","2026-08-22"), 3);
    expect(s.weeklyGoalReached).toBe(true);
    expect(s.weeklyCompleted).toBe(3);
    expect(s.weeklyRemaining).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// weeklyStreakTPW — streak-breaking rules, first partial week, edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe("weeklyStreakTPW", () => {

  it("4. prev streak 4, current Wed 1/3 → streak preserved at 4 (in-progress)", () => {
    // Past four weeks (Jul 20, Jul 27, Aug 3, Aug 10) — all successful.
    const past = only(
      "2026-07-20","2026-07-21","2026-07-22",
      "2026-07-27","2026-07-28","2026-07-29",
      "2026-08-03","2026-08-04","2026-08-05",
      "2026-08-10","2026-08-11","2026-08-12",
    );
    // Current week Aug 17–23: only Mon Aug 17 = 1/3. refDate = Wed Aug 19.
    const current = only("2026-08-17");
    expect(streak("2026-07-20", "2026-08-19", [...past, ...current], 3).weeklyStreak).toBe(4);
  });

  it("5. prev streak 4, current Saturday reaches 3/3 → streak = 5 immediately", () => {
    const past = only(
      "2026-07-20","2026-07-21","2026-07-22",
      "2026-07-27","2026-07-28","2026-07-29",
      "2026-08-03","2026-08-04","2026-08-05",
      "2026-08-10","2026-08-11","2026-08-12",
    );
    const current = only("2026-08-17","2026-08-18","2026-08-22"); // Mon+Tue+Sat
    const s = streak("2026-07-20", "2026-08-22", [...past, ...current], 3);
    expect(s.weeklyStreak).toBe(5);
    expect(s.currentWeekSuccessful).toBe(true);
  });

  it("6. prev streak 4, Sunday closes 2/3 → streak = 0 (failure)", () => {
    const past = only(
      "2026-07-20","2026-07-21","2026-07-22",
      "2026-07-27","2026-07-28","2026-07-29",
      "2026-08-03","2026-08-04","2026-08-05",
      "2026-08-10","2026-08-11","2026-08-12",
    );
    const current = only("2026-08-17","2026-08-18"); // Mon+Tue only
    const s = streak("2026-07-20", "2026-08-23", [...past, ...current], 3);
    expect(s.weeklyStreak).toBe(0);
    expect(s.currentWeekFailed).toBe(true);
    expect(s.currentWeekComplete).toBe(true);
  });

  it("9. start Wednesday, target 3, Wed+Thu+Sat complete → first partial week eligible and successful", () => {
    // Start Aug 19 (Wed). Aug 19–23 = 5 available days. 5 >= 3 → eligible.
    const s = streak("2026-08-19", "2026-08-22", only("2026-08-19","2026-08-20","2026-08-22"), 3);
    expect(s.weeklyStreak).toBe(1);
    expect(s.currentWeekSuccessful).toBe(true);
  });

  it("10. start Saturday, target 5 → first partial week neutral (2 < 5)", () => {
    // Start Aug 22 (Sat). Aug 22–23 = 2 available days. 2 < 5 → neutral.
    // No completions. Current week is closed but neutral — streak = 0,
    // currentWeekFailed = false (S6: not a failure).
    const s = streak("2026-08-22", "2026-08-23", noDates(), 5);
    expect(s.weeklyStreak).toBe(0);
    expect(s.currentWeekComplete).toBe(true);
    expect(s.currentWeekFailed).toBe(false); // neutral, not failed
  });

  it("11. start Saturday, target 3, 2 completions → first partial week neutral, NOT a failure", () => {
    // Sat Aug 22 + Sun Aug 23 = 2 available days. 2 < 3 → first week is
    // NEUTRAL (S6). Even though the week is closed below target, it does
    // NOT count as a failure — streak remains 0 (no successful weeks).
    const s = streak("2026-08-22", "2026-08-23", only("2026-08-22","2026-08-23"), 3);
    expect(s.weeklyStreak).toBe(0);
    expect(s.currentWeekComplete).toBe(true);
    expect(s.currentWeekFailed).toBe(false); // neutral — not a failure (S6)
  });

  it("12. target 1 → trivial success (current week in-progress reaches target)", () => {
    const s = streak("2026-08-17", REF, only("2026-08-17","2026-08-19","2026-08-22"), 1);
    expect(s.weeklyStreak).toBe(1);
    expect(s.currentWeekSuccessful).toBe(true);
  });

  it("13. target 7 → only Sun Aug 23 completed → 1/7 below target, streak = 0", () => {
    const s = streak("2026-08-17", "2026-08-23", only("2026-08-23"), 7);
    expect(s.weeklyStreak).toBe(0);
    expect(s.currentWeekFailed).toBe(true);
    expect(s.currentWeekComplete).toBe(true);
  });

  it("16. before-start completion ignored; start-week meets target → streak 1", () => {
    // Start Aug 20. Aug 17 (prev week) is before startDate → ignored.
    // Current week Aug 17–23 has 3 completions (Aug 20,21,22) = 3/3.
    const s = streak("2026-08-20", "2026-08-22", only("2026-08-17","2026-08-20","2026-08-21","2026-08-22"), 3);
    expect(s.weeklyStreak).toBe(1);
    expect(s.currentWeekSuccessful).toBe(true); // reached target while in-progress
  });

  it("20. five consecutive successful weeks → streak = 5, current week also successful", () => {
    // 5 completed weeks of 3 each, plus current week completes successfully.
    // Aug 17–23 has all 3 days (Mon+Tue+Wed) completed.
    const s = streak("2026-07-20", "2026-08-23", only(
      "2026-07-20","2026-07-21","2026-07-22",
      "2026-07-27","2026-07-28","2026-07-29",
      "2026-08-03","2026-08-04","2026-08-05",
      "2026-08-10","2026-08-11","2026-08-12",
      "2026-08-17","2026-08-18","2026-08-19",
    ), 3);
    expect(s.weeklyStreak).toBe(5);
    expect(s.currentWeekComplete).toBe(true);
    expect(s.currentWeekSuccessful).toBe(true);
  });
});