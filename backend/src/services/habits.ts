import { prisma } from "../lib/prisma.js";
import type { HabitInput } from "../lib/validation.js";

// Safe habit shape — the only habit representation returned to clients.
// No stats yet (Phase 5); includes type so later phases can branch on it.
export function toSafeHabit(habit: { id: number; name: string; type: "BUILD" | "BREAK"; createdAt: Date }) {
  return { id: habit.id, name: habit.name, type: habit.type, createdAt: habit.createdAt.toISOString() };
}

// Ownership is always the authenticated userId — never client-supplied (STEP 2/10).
export async function createHabit(userId: number, input: HabitInput) {
  return prisma.habit.create({ data: { userId, name: input.name, type: input.type } });
}

// Scoped by userId — never an unscoped findMany (STEP 4).
export async function listHabits(userId: number) {
  return prisma.habit.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" }, // deterministic; newest first (engineering detail)
  });
}

// Ownership-hiding lookup (D7): foreign/nonexistent → null, caller returns 404.
export async function getOwnedHabit(userId: number, id: number) {
  return prisma.habit.findFirst({ where: { id, userId } });
}
