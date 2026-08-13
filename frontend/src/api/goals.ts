import { apiRequest } from "./client";
import type { HabitType } from "./habits";

// Goal API (contract §5). All calls relative /api, token attached by
// apiRequest. Backend embeds the safe habit { id, name, type } — the UI
// never reconstructs ownership client-side.

export type Goal = {
  id: number;
  habitId: number;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  habit: { id: number; name: string; type: HabitType };
};

export type GoalInput = {
  habitId: number;
  title: string;
  description?: string | null;
};

export function listGoals(token: string): Promise<{ goals: Goal[] }> {
  return apiRequest("/api/goals", { token });
}

export function createGoal(token: string, input: GoalInput): Promise<{ goal: Goal }> {
  return apiRequest("/api/goals", { token, body: input });
}

export function updateGoal(token: string, id: number, input: Partial<GoalInput>): Promise<{ goal: Goal }> {
  return apiRequest(`/api/goals/${id}`, { token, method: "PATCH", body: input });
}

export function deleteGoal(token: string, id: number): Promise<unknown> {
  return apiRequest(`/api/goals/${id}`, { token, method: "DELETE" });
}
