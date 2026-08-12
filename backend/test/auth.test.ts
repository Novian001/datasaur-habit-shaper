import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const TEST_EMAIL = "phase3-test@example.invalid";
const TEST_PASSWORD = "supersecret1";

// Controlled test DB (habit_shaper_test) — no production data. Reset per test.
beforeEach(async () => {
  await prisma.user.deleteMany();
});

// Helpers
async function register(email: string, password: string) {
  return request(app).post("/api/auth/register").send({ email, password });
}
async function login(email: string, password: string) {
  return request(app).post("/api/auth/login").send({ email, password });
}
const me = (token: string) =>
  request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

describe("auth register", () => {
  it("1. registration succeeds with 201 + token + safe user", async () => {
    const res = await register(TEST_EMAIL, TEST_PASSWORD);
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(TEST_EMAIL);
    expect(res.body.user.id).toBeGreaterThan(0);
    expect(res.body.user.createdAt).toBeTruthy();
    expect(res.body.token).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("2. invalid email rejected (400)", async () => {
    const res = await register("not-an-email", TEST_PASSWORD);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("3. too-short password rejected (400)", async () => {
    const res = await register(TEST_EMAIL, "short");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("4. duplicate email rejected (409 CONFLICT)", async () => {
    await register(TEST_EMAIL, TEST_PASSWORD);
    const res = await register(TEST_EMAIL, TEST_PASSWORD);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("15. email normalized to lowercase (case-insensitive duplicate)", async () => {
    const res = await register("CaseMix@Example.COM", TEST_PASSWORD);
    expect(res.status).toBe(201);
    const stored = await prisma.user.findUnique({ where: { email: "casemix@example.com" } });
    expect(stored).not.toBeNull();
    // Same email different case → duplicate 409
    const dup = await register("CASEMIX@EXAMPLE.COM", TEST_PASSWORD);
    expect(dup.status).toBe(409);
  });
});

describe("auth login", () => {
  beforeEach(async () => {
    await register(TEST_EMAIL, TEST_PASSWORD);
  });

  it("5. password stored hashed, not plaintext", async () => {
    const stored = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    expect(stored).not.toBeNull();
    expect(stored!.passwordHash).not.toBe(TEST_PASSWORD);
    expect(stored!.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt prefix
  });

  it("6. valid login succeeds (200 + token)", async () => {
    const res = await login(TEST_EMAIL, TEST_PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe(TEST_EMAIL);
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("7. wrong password rejected (401, generic)", async () => {
    const res = await login(TEST_EMAIL, "wrongpassword");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("8. unknown email same generic 401 (no enumeration)", async () => {
    const res = await login("nobody@example.invalid", TEST_PASSWORD);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
    expect(res.body.error.message).toBe("Invalid email or password");
  });
});

describe("auth me (protected)", () => {
  let token: string;
  beforeEach(async () => {
    const res = await register(TEST_EMAIL, TEST_PASSWORD);
    token = res.body.token;
  });

  it("9. passwordHash never appears in any response", async () => {
    const res = await me(token);
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
    expect(res.body.user).not.toHaveProperty("passwordHash");
  });

  it("10. protected endpoint without token → 401", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("11. malformed token → 401", async () => {
    const res = await me("not.a.jwt");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("13. expired token → 401", async () => {
    const expired = jwt.sign(
      { sub: 1, email: TEST_EMAIL },
      process.env.JWT_SECRET!,
      { expiresIn: -1 },
    );
    const res = await me(expired);
    expect(res.status).toBe(401);
  });

  it("13b. invalid-signature token → 401", async () => {
    const wrong = jwt.sign(
      { sub: 1, email: TEST_EMAIL },
      "a-different-secret-that-is-long-enough",
    );
    const res = await me(wrong);
    expect(res.status).toBe(401);
  });

  it("12/14. valid token → 200, returns only the authenticated user", async () => {
    const res = await me(token);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(TEST_EMAIL);
    expect(res.body.user.id).toBeGreaterThan(0);
    expect(res.body.user).not.toHaveProperty("passwordHash");
    expect(Object.keys(res.body.user).sort()).toEqual(["createdAt", "email", "id"]);
  });
});
