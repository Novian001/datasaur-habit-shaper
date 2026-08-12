import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const healthRouter = Router();

// Health/readiness gate. Returns `{ status: "ok", db: "up" }` after a cheap
// SELECT 1 through Prisma (architecture §8). DB failure → 503, not 200.
healthRouter.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "up" });
  } catch {
    res.status(503).json({ status: "error", db: "down" });
  }
});
