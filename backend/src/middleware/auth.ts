import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../lib/jwt.js";
import { unauthorized } from "../lib/errors.js";

// Express 5 types: attach userId to the request.
declare module "express-serve-static-core" {
  interface Request {
    userId?: number;
  }
}

// Authenticated-user middleware (architecture §3.3): verifies Bearer JWT,
// attaches req.userId. Deterministic: missing/invalid/expired → 401 (never 403).
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(unauthorized("Missing or invalid authorization header"));
  }
  try {
    const payload = verifyToken(header.slice("Bearer ".length));
    req.userId = payload.sub;
    next();
  } catch {
    next(unauthorized("Invalid or expired token"));
  }
}
