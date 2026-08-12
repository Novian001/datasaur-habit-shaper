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

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
