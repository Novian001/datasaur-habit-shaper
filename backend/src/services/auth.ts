import { prisma } from "../lib/prisma.js";
import { conflict } from "../lib/errors.js";
import type { RegisterInput } from "../lib/validation.js";

// Safe user shape — the ONLY user representation returned to clients.
// Never includes passwordHash (R25 / STEP 9).
export function toSafeUser(user: { id: number; email: string; createdAt: Date }) {
  return { id: user.id, email: user.email, createdAt: user.createdAt.toISOString() };
}

export async function createUser(input: RegisterInput) {
  try {
    return await prisma.user.create({
      data: { email: input.email, passwordHash: input.password },
    });
  } catch (err) {
    // Prisma P2002 = unique constraint violation → duplicate email → 409.
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      throw conflict("Email already registered");
    }
    throw err;
  }
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}
