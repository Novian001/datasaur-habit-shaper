// Goal CRUD (Phase 6, api-contract.md §5). Ownership is always the
// authenticated userId — never client-supplied. Foreign/nonexistent resources
// → null, caller returns 404 (D7 uniform hiding; never 403).
//
// Goal belongs to exactly one Habit; a Habit may have many Goals. Deleting a
// Goal deletes only the Goal row — the linked Habit stays (schema: Goal
// has the FK, onDelete: Cascade is Habit→Goal, not the reverse).

import { prisma } from "../lib/prisma.js";
import type { GoalCreateInput, GoalUpdateInput } from "../lib/validation.js";
import { getOwnedHabit } from "./habits.js";

// Safe goal shape — the only goal representation returned to clients.
// Embedded habit carries only the safe fields the contract's UI picker needs
// (id, name, type); never userId, passwordHash, tracking rows.
export function toSafeGoal(goal: {
  id: number;
  habitId: number;
  title: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  habit?: { id: number; name: string; type: "BUILD" | "BREAK" } | null;
}) {
  return {
    id: goal.id,
    habitId: goal.habitId,
    title: goal.title,
    description: goal.description,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
    habit: goal.habit
      ? { id: goal.habit.id, name: goal.habit.name, type: goal.habit.type }
      : null,
  };
}

// Ownership-hiding lookup (D7): foreign/nonexistent → null, caller → 404.
export async function getOwnedGoal(userId: number, id: number) {
  return prisma.goal.findFirst({ where: { id, userId } });
}

// CREATE: validate → verify linked habit is owned by caller (404 if not) →
// create with authenticated userId → return goal + embedded habit.
export async function createGoal(userId: number, input: GoalCreateInput) {
  // habitId ownership BEFORE any write (D7; contract §5): a foreign or
  // nonexistent habit is indistinguishable → 404, never 403.
  const habit = await getOwnedHabit(userId, input.habitId);
  if (!habit) return null;

  const goal = await prisma.goal.create({
    data: {
      userId,
      habitId: input.habitId,
      title: input.title,
      description: input.description ?? null,
    },
  });
  return {
    goal,
    habit: { id: habit.id, name: habit.name, type: habit.type },
  };
}

// LIST: scoped by userId in the query (never load-all-then-filter).
// Deterministic order: newest first (matches listHabits convention). Embed
// the linked habit's safe fields (contract §5 GET shape).
export async function listGoals(userId: number) {
  return prisma.goal.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { habit: { select: { id: true, name: true, type: true } } },
  });
}

// UPDATE (PATCH): ownership-scoped lookup; foreign/nonexistent → null.
// Partial semantics: only provided fields change; description: null clears
// it (contract §5 allows null). If habitId changes, the new habit must be
// owned by the caller (404 otherwise, D7). Both BUILD and BREAK are valid.
export async function updateGoal(userId: number, id: number, input: GoalUpdateInput) {
  const goal = await getOwnedGoal(userId, id);
  if (!goal) return null;

  if (input.habitId !== undefined && input.habitId !== goal.habitId) {
    const habit = await getOwnedHabit(userId, input.habitId);
    if (!habit) return null;
  }

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.habitId !== undefined) data.habitId = input.habitId;
  if (input.description !== undefined) data.description = input.description ?? null;

  const updated = await prisma.goal.update({
    where: { id },
    data,
    include: { habit: { select: { id: true, name: true, type: true } } },
  });
  return updated;
}

// DELETE: ownership-scoped; foreign/nonexistent → null. Deletes ONLY the Goal
// row — never the linked Habit (schema FK direction: Goal→Habit).
export async function deleteGoal(userId: number, id: number) {
  const goal = await getOwnedGoal(userId, id);
  if (!goal) return null;
  await prisma.goal.delete({ where: { id } });
  return true;
}
