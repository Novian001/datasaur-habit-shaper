import { Router } from "express";

export const healthRouter = Router();

// Health/readiness gate. Returns `{ status: "ok" }` (Phase 1: no DB layer yet;
// the `db: "up"` field arrives with Prisma in Phase 2 — architecture.md §8).
healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});
