import jwt, { type JwtPayload } from "jsonwebtoken";

// JWT_SECRET is required at runtime (see server.ts fail-fast). Never a hard-coded default.
export const jwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "JWT_SECRET must be set to a strong random value of at least 16 characters",
    );
  }
  return secret;
};

// Approved token contract (architecture §3.3): { sub: userId, email }, expiry 7d.
export interface TokenPayload {
  sub: number;
  email: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, jwtSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, jwtSecret()) as JwtPayload;
  if (typeof decoded.sub !== "number" || typeof decoded.email !== "string") {
    throw new Error("Invalid token payload");
  }
  return { sub: decoded.sub, email: decoded.email };
}
