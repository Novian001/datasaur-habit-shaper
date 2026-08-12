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

// Habit: name 1–120 chars (api-contract.md), trimmed; type BUILD|BREAK only;
// startDate = the user's local calendar date the habit begins (D8). Real-date
// validity is checked by isValidDateString (lib/dates.ts).
export const habitSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name must be at most 120 characters"),
  type: z.enum(["BUILD", "BREAK"], { message: "Type must be BUILD or BREAK" }),
  startDate: z.string().min(1, "startDate is required"),
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
