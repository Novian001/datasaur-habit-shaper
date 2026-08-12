import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const PASS = "testpass123";
// A fixed calendar date used as the client-supplied habit startDate (D8).
// Explicit string — the write-window tests never depend on the server clock.
const START = "2026-08-10";
// Client-supplied reference date for stats GETs (contract §2 requires
// refDate on the habit list/detail endpoints; D8 — no server clock).
const REF = "2026-08-12";

// Controlled test DB (habit_shaper_test) — no production data. Reset per test.
beforeEach(async () => {
  await prisma.user.deleteMany();
});

async function registerUser(email: string) {
  const res = await request(app).post("/api/auth/register").send({ email, password: PASS });
  return res.body.token as string;
}

async function createHabit(token: string, name: string, type: string, startDate?: string) {
  return request(app)
    .post("/api/habits")
    .set("Authorization", `Bearer ${token}`)
    .send({ name, type, startDate: startDate ?? START });
}

describe("habits authorization", () => {
  it("1. GET /habits without token → 401", async () => {
    const res = await request(app).get("/api/habits");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("2. POST /habits without token → 401", async () => {
    const res = await request(app).post("/api/habits").send({ name: "X", type: "BUILD", startDate: START });
    expect(res.status).toBe(401);
  });

  it("3. GET /habits/:id without token → 401", async () => {
    const res = await request(app).get("/api/habits/1");
    expect(res.status).toBe(401);
  });
});

describe("habits create", () => {
  let token: string;
  beforeEach(async () => {
    token = await registerUser("a@example.invalid");
  });

  it("4. authenticated user can create BUILD habit → 201", async () => {
    const res = await createHabit(token, "Meditate", "BUILD");
    expect(res.status).toBe(201);
    expect(res.body.habit.name).toBe("Meditate");
    expect(res.body.habit.type).toBe("BUILD");
    expect(res.body.habit.userId).toBeUndefined();
  });

  it("5. authenticated user can create BREAK habit → 201", async () => {
    const res = await createHabit(token, "Smoking", "BREAK");
    expect(res.status).toBe(201);
    expect(res.body.habit.type).toBe("BREAK");
  });

  it("6. invalid habit type rejected → 400", async () => {
    const res = await createHabit(token, "Meditate", "STRETCH");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("7. empty/invalid name rejected → 400", async () => {
    const empty = await createHabit(token, "", "BUILD");
    expect(empty.status).toBe(400);
    const tooLong = await createHabit(token, "x".repeat(121), "BUILD");
    expect(tooLong.status).toBe(400);
  });

  it("8. client-supplied userId cannot override ownership (stripped by validation)", async () => {
    const res = await request(app)
      .post("/api/habits")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Hijack", type: "BUILD", userId: 999, startDate: START });
    expect(res.status).toBe(201);
    // zod strips unknown keys; the habit belongs to the token's user, not 999.
    const stored = await prisma.habit.findFirst({ where: { name: "Hijack" } });
    expect(stored?.userId).not.toBe(999);
    expect(stored?.userId).toBeGreaterThan(0);
  });
});

describe("habits list", () => {
  it("9/10/11. user sees only their own habits; empty list is valid", async () => {
    const a = await registerUser("a@example.invalid");
    const b = await registerUser("b@example.invalid");
    await createHabit(a, "A-One", "BUILD");
    await createHabit(a, "A-Two", "BREAK");
    await createHabit(b, "B-One", "BUILD");

    const la = await request(app).get(`/api/habits?refDate=${REF}`).set("Authorization", `Bearer ${a}`);
    expect(la.status).toBe(200);
    expect(la.body.habits.map((h: { name: string }) => h.name).sort()).toEqual(["A-One", "A-Two"]);

    const lb = await request(app).get(`/api/habits?refDate=${REF}`).set("Authorization", `Bearer ${b}`);
    expect(lb.status).toBe(200);
    expect(lb.body.habits.map((h: { name: string }) => h.name)).toEqual(["B-One"]);

    const nobody = await registerUser("nobody@example.invalid");
    const le = await request(app).get(`/api/habits?refDate=${REF}`).set("Authorization", `Bearer ${nobody}`);
    expect(le.status).toBe(200);
    expect(le.body.habits).toEqual([]);
  });
});

describe("habits detail", () => {
  let a: string;
  let b: string;
  let aHabitId: number;
  let bHabitId: number;
  beforeEach(async () => {
    a = await registerUser("a@example.invalid");
    b = await registerUser("b@example.invalid");
    aHabitId = (await createHabit(a, "A-Habit", "BUILD")).body.habit.id;
    bHabitId = (await createHabit(b, "B-Habit", "BUILD")).body.habit.id;
  });

  it("12. owner can retrieve habit → 200", async () => {
    const res = await request(app).get(`/api/habits/${aHabitId}?refDate=${REF}`).set("Authorization", `Bearer ${a}`);
    expect(res.status).toBe(200);
    expect(res.body.habit.name).toBe("A-Habit");
    expect(res.body.habit.id).toBe(aHabitId);
  });

  it("13. foreign habit → 404 (uniform hiding, no 403)", async () => {
    const res = await request(app).get(`/api/habits/${bHabitId}?refDate=${REF}`).set("Authorization", `Bearer ${a}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    // B accessing A's habit also 404
    const res2 = await request(app).get(`/api/habits/${aHabitId}?refDate=${REF}`).set("Authorization", `Bearer ${b}`);
    expect(res2.status).toBe(404);
  });

  it("14. nonexistent habit → 404", async () => {
    const res = await request(app).get(`/api/habits/999999?refDate=${REF}`).set("Authorization", `Bearer ${a}`);
    expect(res.status).toBe(404);
  });

  it("15. malformed id handled per contract (404, not 500)", async () => {
    const res = await request(app).get(`/api/habits/abc?refDate=${REF}`).set("Authorization", `Bearer ${a}`);
    expect(res.status).toBe(404);
  });
});

describe("habits data safety", () => {
  it("16. returned habit structure exposes no unrelated user data", async () => {
    const token = await registerUser("a@example.invalid");
    const created = await createHabit(token, "Safe", "BUILD");
    const id = created.body.habit.id;
    for (const res of [created, await request(app).get(`/api/habits/${id}?refDate=${REF}`).set("Authorization", `Bearer ${token}`)]) {
      expect(Object.keys(res.body.habit).sort()).toEqual(["createdAt", "id", "name", "startDate", "type"]);
      expect(JSON.stringify(res.body)).not.toContain("userId");
      expect(JSON.stringify(res.body)).not.toContain("password");
    }
    const list = await request(app).get(`/api/habits?refDate=${REF}`).set("Authorization", `Bearer ${token}`);
    // List items carry computed stats per contract §2 (habit fields + stats).
    expect(Object.keys(list.body.habits[0]).sort()).toEqual(["createdAt", "id", "name", "startDate", "stats", "type"]);
  });
});

describe("habits startDate (D8 local-calendar boundary)", () => {
  it("17. create with valid startDate → 201, startDate echoed as YYYY-MM-DD", async () => {
    const token = await registerUser("a@example.invalid");
    const res = await createHabit(token, "Edge", "BUILD", "2026-08-12");
    expect(res.status).toBe(201);
    expect(res.body.habit.startDate).toBe("2026-08-12");
  });

  it("18. malformed startDate (2026-02-30 / not-a-date) → 400, nothing stored", async () => {
    const token = await registerUser("a@example.invalid");
    for (const bad of ["2026-02-30", "not-a-date"]) {
      const res = await request(app)
        .post("/api/habits")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Bad", type: "BUILD", startDate: bad });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect(await prisma.habit.count()).toBe(0);
  });
});
