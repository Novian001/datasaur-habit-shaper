import { apiRequest } from "./client";
import { todayLocal } from "../lib/date";

// Habit API (contract §2–§4). All calls relative /api, token attached by
// apiRequest. Dates are the client's local calendar dates (D8).

export type HabitType = "BUILD" | "BREAK";

export type Habit = {
  id: number;
  name: string;
  type: HabitType;
  startDate: string;
  createdAt: string;
  stats: {
    currentStreak?: number;
    weekCompleted?: number;
    weekElapsedDays?: number;
    weekCompletionRate?: number;
    missedDays?: number;
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
  input: { name: string; type: HabitType; startDate: string },
): Promise<{ habit: Habit }> {
  return apiRequest("/api/habits", { token, body: input });
}

// Mark a BUILD habit completed for a date (PUT, idempotent 201/200).
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
