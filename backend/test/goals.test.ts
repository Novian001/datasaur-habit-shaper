import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

// Goal CRUD integration tests (Phase 6, api-contract.md §5).
// Fixed calendar date (D8) — no server clock. Ownership is always the JWT
// user; foreign/nonexistent → 404 (D7, never 403).

const PASS = "testpass123";
const START = "2026-08-10";

beforeEach(async () => {
  await prisma.user.deleteMany();
});

async function registerUser(email: string) {
  const res = await request(app).post("/api/auth/register").send({ email, password: PASS });
  return res.body.token as string;
}

async function createHabit(token: string, name: string, type: string, startDate: string = START) {
  const res = await request(app)
    .post("/api/habits")
    .set("Authorization", `Bearer ${token}`)
    .send({ name, type, startDate });
  return res.body.habit as { id: number };
}

describe("goals auth", () => {
  it("1. GET /goals without token → 401", async () => {
    const res = await request(app).get("/api/goals");
    expect(res.status).toBe(401);
  });

  it("2. POST /goals without token → 401", async () => {
    const res = await request(app).post("/api/goals").send({ habitId: 1, title: "G" });
    expect(res.status).toBe(401);
  });

  it("3. PATCH /goals/:id without token → 401", async () => {
    const res = await request(app).patch("/api/goals/1").send({ title: "G" });
    expect(res.status).toBe(401);
  });

  it("4. DELETE /goals/:id without token → 401", async () => {
    const res = await request(app).delete("/api/goals/1");
    expect(res.status).toBe(401);
  });
});

describe("goals create", () => {
  let token: string;
  let buildId: number;
  let breakId: number;
  beforeEach(async () => {
    token = await registerUser("a@example.invalid");
    buildId = (await createHabit(token, "Meditate", "BUILD")).id;
    breakId = (await createHabit(token, "Smoking", "BREAK")).id;
  });

  it("5. owner can create goal linked to BUILD habit → 201", async () => {
    const res = await request(app)
      .post("/api/goals")
      .set("Authorization", `Bearer ${token}`)
      .send({ habitId: buildId, title: "Meditate daily", description: "10 min every morning" });
    expect(res.status).toBe(201);
    expect(res.body.goal.habitId).toBe(buildId);
    expect(res.body.goal.title).toBe("Meditate daily");
    expect(res.body.goal.description).toBe("10 min every morning");
    // Contract §5: goal object with embedded habit (id/name/type only).
    expect(res.body.goal.habit).toEqual({ id: buildId, name: "Meditate", type: "BUILD" });
    expect(res.body.goal).not.toHaveProperty("userId");
    expect(res.body.goal).not.toHaveProperty("password");
  });

  it("6. owner can create goal linked to BREAK habit → 201", async () => {
    const res = await request(app)
      .post("/api/goals")
      .set("Authorization", `Bearer ${token}`)
      .send({ habitId: breakId, title: "Quit smoking" });
    expect(res.status).toBe(201);
    expect(res.body.goal.habit.type).toBe("BREAK");
  });

  it("7. empty title rejected → 400", async () => {
    const res = await request(app)
      .post("/api/goals")
      .set("Authorization", `Bearer ${token}`)
      .send({ habitId: buildId, title: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("8. invalid title/description length rejected → 400", async () => {
    const tooLongTitle = await request(app)
      .post("/api/goals")
      .set("Authorization", `Bearer ${token}`)
      .send({ habitId: buildId, title: "x".repeat(201) });
    expect(tooLongTitle.status).toBe(400);
    const tooLongDesc = await request(app)
      .post("/api/goals")
      .set("Authorization", `Bearer ${token}`)
      .send({ habitId: buildId, title: "G", description: "y".repeat(1001) });
    expect(tooLongDesc.status).toBe(400);
  });

  it("9. nonexistent habit → 404", async () => {
    const res = await request(app)
      .post("/api/goals")
      .set("Authorization", `Bearer ${token}`)
      .send({ habitId: 999999, title: "G" });
    expect(res.status).toBe(404);
  });

  it("10. foreign habit → 404 (D7 uniform hiding)", async () => {
    const b = await registerUser("b@example.invalid");
    const bHabit = (await createHabit(b, "B", "BUILD")).id;
    const res = await request(app)
      .post("/api/goals")
      .set("Authorization", `Bearer ${token}`)
      .send({ habitId: bHabit, title: "G" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("11. client userId cannot override ownership → 201 with token user", async () => {
    const res = await request(app)
      .post("/api/goals")
      .set("Authorization", `Bearer ${token}`)
      .send({ habitId: buildId, title: "G", userId: 999 });
    // Unknown fields are stripped by zod (project policy); ownership is the
    // token user, never the client. Row must belong to the token user.
    expect(res.status).toBe(201);
    const row = await prisma.goal.findFirstOrThrow({ where: { habitId: buildId, title: "G" } });
    const me = await prisma.user.findFirstOrThrow({ where: { email: "a@example.invalid" } });
    expect(row.userId).toBe(me.id);
  });
});

describe("goals list", () => {
  it("12. user sees only their goals", async () => {
    const a = await registerUser("a@example.invalid");
    const b = await registerUser("b@example.invalid");
    const aHabit = (await createHabit(a, "A", "BUILD")).id;
    const bHabit = (await createHabit(b, "B", "BUILD")).id;
    const goal = (g: string, h: number) => request(app).post("/api/goals").set("Authorization", `Bearer ${g}`).send({ habitId: h, title: "G" });
    await goal(a, aHabit);
    await goal(a, aHabit);
    await goal(b, bHabit);

    const la = await request(app).get("/api/goals").set("Authorization", `Bearer ${a}`);
    expect(la.status).toBe(200);
    expect(la.body.goals).toHaveLength(2);
    expect(la.body.goals.every((g: { habitId: number }) => g.habitId === aHabit)).toBe(true);

    const lb = await request(app).get("/api/goals").set("Authorization", `Bearer ${b}`);
    expect(lb.status).toBe(200);
    expect(lb.body.goals).toHaveLength(1);
    expect(lb.body.goals[0].habitId).toBe(bHabit);
  });

  it("13. empty list returns valid empty response", async () => {
    const a = await registerUser("a@example.invalid");
    const res = await request(app).get("/api/goals").set("Authorization", `Bearer ${a}`);
    expect(res.status).toBe(200);
    expect(res.body.goals).toEqual([]);
  });

  it("14. linked habit output matches contract (safe fields only)", async () => {
    const a = await registerUser("a@example.invalid");
    const h = (await createHabit(a, "Meditate", "BUILD")).id;
    await request(app).post("/api/goals").set("Authorization", `Bearer ${a}`).send({ habitId: h, title: "G" });
    const res = await request(app).get("/api/goals").set("Authorization", `Bearer ${a}`);
    const goal = res.body.goals[0];
    // Contract §5 GET shape: id, habitId, title, description, createdAt,
    // updatedAt, habit{id,name,type}.
    expect(Object.keys(goal).sort()).toEqual(["createdAt", "description", "habit", "habitId", "id", "title", "updatedAt"]);
    expect(goal.habit).toEqual({ id: h, name: "Meditate", type: "BUILD" });
    expect(JSON.stringify(goal)).not.toContain("userId");
  });
});

describe("goals update", () => {
  let token: string;
  let habitId: number;
  let goalId: number;
  beforeEach(async () => {
    token = await registerUser("a@example.invalid");
    habitId = (await createHabit(token, "Meditate", "BUILD")).id;
    goalId = (
      await request(app).post("/api/goals").set("Authorization", `Bearer ${token}`).send({ habitId, title: "Old", description: "Old desc" })
    ).body.goal.id;
  });

  it("15. owner can edit title → 200", async () => {
    const res = await request(app)
      .patch(`/api/goals/${goalId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "New title" });
    expect(res.status).toBe(200);
    expect(res.body.goal.title).toBe("New title");
    expect(res.body.goal.description).toBe("Old desc"); // untouched
  });

  it("16. owner can edit description → 200", async () => {
    const res = await request(app)
      .patch(`/api/goals/${goalId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ description: "New desc" });
    expect(res.status).toBe(200);
    expect(res.body.goal.description).toBe("New desc");
    expect(res.body.goal.title).toBe("Old"); // untouched
  });

  it("17. owner can clear optional description → 200 (null)", async () => {
    const res = await request(app)
      .patch(`/api/goals/${goalId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ description: null });
    expect(res.status).toBe(200);
    expect(res.body.goal.description).toBeNull();
  });

  it("20. owner can relink to own BUILD/BREAK habit → 200", async () => {
    const build2 = (await createHabit(token, "Read", "BUILD")).id;
    const breakH = (await createHabit(token, "Smoking", "BREAK")).id;
    const r1 = await request(app).patch(`/api/goals/${goalId}`).set("Authorization", `Bearer ${token}`).send({ habitId: build2 });
    expect(r1.status).toBe(200);
    expect(r1.body.goal.habitId).toBe(build2);
    expect(r1.body.goal.habit.type).toBe("BUILD");
    const r2 = await request(app).patch(`/api/goals/${goalId}`).set("Authorization", `Bearer ${token}`).send({ habitId: breakH });
    expect(r2.status).toBe(200);
    expect(r2.body.goal.habit.type).toBe("BREAK");
  });

  it("21. cannot relink to foreign habit → 404", async () => {
    const b = await registerUser("b@example.invalid");
    const bHabit = (await createHabit(b, "B", "BUILD")).id;
    const res = await request(app)
      .patch(`/api/goals/${goalId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ habitId: bHabit });
    expect(res.status).toBe(404);
    // Goal unchanged.
    const row = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
    expect(row.habitId).toBe(habitId);
  });

  it("18. foreign goal → 404", async () => {
    const b = await registerUser("b@example.invalid");
    const bHabit = (await createHabit(b, "B", "BUILD")).id;
    const bGoal = (await request(app).post("/api/goals").set("Authorization", `Bearer ${b}`).send({ habitId: bHabit, title: "B" })).body.goal.id;
    const res = await request(app)
      .patch(`/api/goals/${bGoal}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "hacked" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("19. nonexistent goal → 404", async () => {
    const res = await request(app).patch("/api/goals/999999").set("Authorization", `Bearer ${token}`).send({ title: "G" });
    expect(res.status).toBe(404);
  });
});

describe("goals delete", () => {
  let token: string;
  let habitId: number;
  let goalId: number;
  beforeEach(async () => {
    token = await registerUser("a@example.invalid");
    habitId = (await createHabit(token, "Meditate", "BUILD")).id;
    goalId = (
      await request(app).post("/api/goals").set("Authorization", `Bearer ${token}`).send({ habitId, title: "G" })
    ).body.goal.id;
  });

  it("22. owner can delete goal → 204", async () => {
    const res = await request(app).delete(`/api/goals/${goalId}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);
  });

  it("23. goal no longer exists afterward", async () => {
    await request(app).delete(`/api/goals/${goalId}`).set("Authorization", `Bearer ${token}`);
    expect(await prisma.goal.count({ where: { id: goalId } })).toBe(0);
  });

  it("24. linked Habit still exists after deleting Goal", async () => {
    await request(app).delete(`/api/goals/${goalId}`).set("Authorization", `Bearer ${token}`);
    expect(await prisma.habit.count({ where: { id: habitId } })).toBe(1);
  });

  it("25. foreign goal → 404", async () => {
    const b = await registerUser("b@example.invalid");
    const bHabit = (await createHabit(b, "B", "BUILD")).id;
    const bGoal = (await request(app).post("/api/goals").set("Authorization", `Bearer ${b}`).send({ habitId: bHabit, title: "B" })).body.goal.id;
    const res = await request(app).delete(`/api/goals/${bGoal}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(await prisma.goal.count({ where: { id: bGoal } })).toBe(1); // untouched
  });

  it("26. nonexistent goal → 404", async () => {
    const res = await request(app).delete("/api/goals/999999").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
