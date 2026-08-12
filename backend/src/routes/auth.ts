import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { registerSchema, loginSchema } from "../lib/validation.js";
import { hashPassword, verifyPassword } from "../services/password.js";
import { createUser, toSafeUser } from "../services/auth.js";
import { signToken } from "../lib/jwt.js";
import { requireAuth } from "../middleware/auth.js";
import { unauthorized } from "../lib/errors.js";

export const authRouter = Router();

// POST /api/auth/register — 201 { user, token }; 400 invalid; 409 duplicate email.
authRouter.post("/register", async (req, res) => {
  const input = registerSchema.parse(req.body);
  const passwordHash = await hashPassword(input.password);
  const user = await createUser({ ...input, password: passwordHash });
  const token = signToken({ sub: user.id, email: user.email });
  res.status(201).json({ user: toSafeUser(user), token });
});

// POST /api/auth/login — 200 { user, token }; 401 generic invalid credentials (no enumeration).
authRouter.post("/login", async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const ok = user && (await verifyPassword(input.password, user.passwordHash));
  if (!ok) throw unauthorized("Invalid email or password");
  const token = signToken({ sub: user.id, email: user.email });
  res.json({ user: toSafeUser(user), token });
});

// GET /api/auth/me — 200 { user }; 401 missing/invalid token.
authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) throw unauthorized("Invalid or expired token");
  res.json({ user: toSafeUser(user) });
});
