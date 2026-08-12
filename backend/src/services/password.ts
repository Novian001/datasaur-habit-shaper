import bcrypt from "bcryptjs";

// Cost 10 (architecture §10). bcryptjs is pure JS — no native build in alpine.
const BCRYPT_COST = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
