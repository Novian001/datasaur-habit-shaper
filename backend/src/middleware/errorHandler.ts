import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError } from "../lib/errors.js";

// Central error handler — consistent { error: { code, message } } shape (architecture §9).
// Never leaks stack traces, Prisma internals, or SQL to the client.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: first?.message ?? "Invalid input" },
    });
    return;
  }
  // Unknown error: log server-side (with stack), return generic 500.
  console.error("Unhandled error:", err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
}
