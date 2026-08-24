import { apiRequest } from "./client";
import { todayLocal } from "../lib/date";

// Habit API (contract §2–§4, extended for TIMES_PER_WEEK). All calls relative
// /api, token attached by apiRequest. Dates are the client's local calendar
// dates (D8).

export type HabitType = "BUILD" | "BREAK";
export type FrequencyType = "DAILY" | "TIMES_PER_WEEK";

export type Habit = {
  id: number;
  name: string;
  type: HabitType;
  frequencyType: FrequencyType;
  weeklyTarget: number | null;
  startDate: string;
  createdAt: string;
  stats: {
    // DAILY BUILD fields (present when frequencyType === "DAILY"):
    currentStreak?: number;
    weekCompleted?: number;
    weekElapsedDays?: number;
    weekCompletionRate?: number;
    missedDays?: number;
    // TIMES_PER_WEEK BUILD fields (present when frequencyType === "TIMES_PER_WEEK"):
    weeklyStreak?: number;
    weeklyTarget?: number;
    weeklyCompleted?: number;
    weeklyRemaining?: number;
    weeklyGoalReached?: boolean;
    weeklyCompletionRate?: number;
    // BREAK fields:
    cleanStreak?: number;
    lastRelapseDate?: string | null;
  };
};

export type HabitDetail = {
  habit: Habit;
  stats: Habit["stats"];
  completedDates?: string[];
  relapseDates?: string[];
};

export function listHabits(token: string): Promise<{ habits: Habit[] }> {
  return apiRequest(`/api/habits?refDate=${todayLocal()}`, { token });
}

export function getHabit(token: string, id: number): Promise<HabitDetail> {
  return apiRequest(`/api/habits/${id}?refDate=${todayLocal()}`, { token });
}

export function createHabit(
  token: string,
  input: {
    name: string;
    type: HabitType;
    startDate: string;
    frequency?: { type: FrequencyType; target?: number };
  },
): Promise<{ habit: Habit }> {
  return apiRequest("/api/habits", { token, body: input });
}

// Mark a BUILD habit completed for a date (PUT, idempotent 201/200).
// Completion semantics are identical for DAILY and TIMES_PER_WEEK — the
// only difference is in how stats are computed.
export function completeHabit(token: string, id: number, date: string): Promise<unknown> {
  return apiRequest(`/api/habits/${id}/completions`, { token, method: "PUT", body: { date, refDate: todayLocal() } });
}

// Undo a completion (DELETE, 204).
export function uncompleteHabit(token: string, id: number, date: string): Promise<unknown> {
  return apiRequest(`/api/habits/${id}/completions/${date}`, { token, method: "DELETE" });
}

// Record a BREAK relapse (POST, idempotent 201/200).
export function recordRelapse(token: string, id: number, relapseDate: string): Promise<unknown> {
  return apiRequest(`/api/habits/${id}/relapses`, { token, body: { relapseDate, refDate: todayLocal() } });
}