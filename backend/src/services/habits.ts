import { prisma } from "../lib/prisma.js";
import type { HabitInput } from "../lib/validation.js";
import type { FrequencyType } from "../generated/prisma/enums.js";

// Safe habit shape returned to clients. Includes frequencyType + weeklyTarget
// so callers can branch on DAILY vs TIMES_PER_WEEK (S11).
export function toSafeHabit(habit: {
  id: number;
  name: string;
  type: "BUILD" | "BREAK";
  frequencyType: FrequencyType;
  weeklyTarget: number | null;
  startDate: Date;
  createdAt: Date;
}) {
  return {
    id: habit.id,
    name: habit.name,
    type: habit.type,
    frequencyType: habit.frequencyType,
    weeklyTarget: habit.weeklyTarget,
    startDate: habit.startDate.toISOString().slice(0, 10),
    createdAt: habit.createdAt.toISOString(),
  };
}

// Ownership is always the authenticated userId — never client-supplied (STEP 2/10).
export async function createHabit(userId: number, input: HabitInput) {
  return prisma.habit.create({
    data: {
      userId,
      name: input.name,
      type: input.type,
      // Default to DAILY; TIMES_PER_WEEK requires target from frequency block.
      frequencyType: input.frequency?.type ?? "DAILY",
      weeklyTarget: input.frequency?.type === "TIMES_PER_WEEK" ? input.frequency.target ?? null : null,
      startDate: new Date(input.startDate + "T00:00:00.000Z"),
    },
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