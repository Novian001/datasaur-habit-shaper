import { z } from "zod";

// Email: lowercase-normalized (deterministic; DB collation is case-insensitive anyway).
export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(255)
  .email("Invalid email address")
  .transform((v) => v.toLowerCase());

// Password: min 8 chars (api-contract.md). No complex policy — coding test, YAGNI.
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

// Optional frequency block for habit creation. Backward-compatible: existing
// POST /api/habits calls without this field default to DAILY.
const frequencySchema = z.object({
  type: z.enum(["DAILY", "TIMES_PER_WEEK"], { message: "Frequency type must be DAILY or TIMES_PER_WEEK" }),
  target: z.number().int().min(1).max(7).optional(),
});

// Habit: name 1–120 chars (api-contract.md), trimmed; type BUILD|BREAK only;
// startDate = the user's local calendar date the habit begins (D8). Real-date
// validity is checked by isValidDateString (lib/dates.ts). Optional frequency
// lets callers specify DAILY (default) or TIMES_PER_WEEK with a 1-7 weekly
// target. BREAK habits silently ignore frequency (enforced at service layer).
export const habitSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120, "Name must be at most 120 characters"),
    type: z.enum(["BUILD", "BREAK"], { message: "Type must be BUILD or BREAK" }),
    startDate: z.string().min(1, "startDate is required"),
    frequency: frequencySchema.optional(),
  })
  .refine(
    (data) => {
      // TIMES_PER_WEEK requires a target in 1-7.
      if (data.frequency?.type === "TIMES_PER_WEEK") {
        return data.frequency.target != null && data.frequency.target >= 1 && data.frequency.target <= 7;
      }
      return true;
    },
    { message: "TIMES_PER_WEEK requires target as integer 1-7", path: ["frequency", "target"] },
  );

// Goal (api-contract.md §5): title 1–200, description ≤ 1000 optional
// (null/undefined = no description). habitId is validated for ownership in
// services/goals.ts (foreign → 404, D7) — never trusted as a bare FK.
export const goalCreateSchema = z.object({
  habitId: z.number().int().positive(),
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be at most 200 characters"),
  description: z.string().trim().max(1000, "Description must be at most 1000 characters").nullable().optional(),
});
// Partial update: any subset; no empty-body sentinel here (contract: 400 on
// invalid, 404 foreign/nonexistent; empty {} → no-op update per strict mode).
export const goalUpdateSchema = z.object({
  habitId: z.number().int().positive().optional(),
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be at most 200 characters").optional(),
  description: z.string().trim().max(1000, "Description must be at most 1000 characters").nullable().optional(),
});

// Tracking date: calendar DATE string (D8) + explicit client refDate for the
// "not in the future" rule (backend never reads a server clock — human-review
// correction 2026-08-12). Real-date validity is checked in services/tracking.ts
// (needs the habit's createdAt).
export const dateSchema = z.object({
  date: z.string().min(1, "Date is required"),
  refDate: z.string().min(1, "refDate is required"),
});
export const relapseSchema = z.object({
  relapseDate: z.string().min(1, "relapseDate is required"),
  refDate: z.string().min(1, "refDate is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type HabitInput = z.infer<typeof habitSchema>;
export type DateInput = z.infer<typeof dateSchema>;
export type GoalCreateInput = z.infer<typeof goalCreateSchema>;
export type GoalUpdateInput = z.infer<typeof goalUpdateSchema>;
