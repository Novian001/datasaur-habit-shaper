import { prisma } from "../lib/prisma.js";
import type { HabitInput } from "../lib/validation.js";

// Safe habit shape — the only habit representation returned to clients.
// No stats yet (Phase 5); includes type so later phases can branch on it.
// startDate is the client-supplied local calendar boundary (D8, human-review
// correction 2026-08-12); createdAt is a plain audit timestamp.
export function toSafeHabit(habit: {
  id: number;
  name: string;
  type: "BUILD" | "BREAK";
  startDate: Date;
  createdAt: Date;
}) {
  return {
    id: habit.id,
    name: habit.name,
    type: habit.type,
    startDate: habit.startDate.toISOString().slice(0, 10),
    createdAt: habit.createdAt.toISOString(),
  };
}

// Ownership is always the authenticated userId — never client-supplied (STEP 2/10).
export async function createHabit(userId: number, input: HabitInput) {
  return prisma.habit.create({
    data: { userId, name: input.name, type: input.type, startDate: new Date(input.startDate + "T00:00:00.000Z") },
  });
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
