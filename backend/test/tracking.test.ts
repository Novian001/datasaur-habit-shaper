import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const PASS = "testpass123";
// Valid calendar dates: within the "not future / not before creation" window.
const TODAY = new Date().toISOString().slice(0, 10);

beforeEach(async () => {
  await prisma.user.deleteMany();
});

async function registerUser(email: string) {
  const res = await request(app).post("/api/auth/register").send({ email, password: PASS });
  return res.body.token as string;
}

async function createHabit(token: string, name: string, type: string) {
  return request(app).post("/api/habits").set("Authorization", `Bearer ${token}`).send({ name, type });
}

describe("build completions", () => {
  let token: string;
  let habitId: number;
  beforeEach(async () => {
    token = await registerUser("a@example.invalid");
    habitId = (await createHabit(token, "Meditate", "BUILD")).body.habit.id;
  });

  it("1. no token → 401", async () => {
    const res = await request(app).put(`/api/habits/${habitId}/completions`).send({ date: TODAY });
    expect(res.status).toBe(401);
  });

  it("2/3. owner completes BUILD habit for valid date → 201 first", async () => {
    const res = await request(app)
      .put(`/api/habits/${habitId}/completions`)
      .set("Authorization", `Bearer ${token}`)
      .send({ date: TODAY });
    expect(res.status).toBe(201);
    expect(res.body.completion.habitId).toBe(habitId);
    expect(res.body.completion.date).toBe(TODAY);
  });

  it("4/5. repeated same PUT → 200, exactly one completion row", async () => {
    const put = () =>
      request(app).put(`/api/habits/${habitId}/completions`).set("Authorization", `Bearer ${token}`).send({ date: TODAY });
    expect((await put()).status).toBe(201);
    expect((await put()).status).toBe(200);
    const rows = await prisma.habitCompletion.findMany({ where: { habitId } });
    expect(rows).toHaveLength(1);
  });

  it("6. invalid calendar date rejected → 400", async () => {
    for (const bad of ["2026-02-30", "2026-13-01", "abcd-ef-gh", "2026-1-1"]) {
      const res = await request(app)
        .put(`/api/habits/${habitId}/completions`)
        .set("Authorization", `Bearer ${token}`)
        .send({ date: bad });
      expect(res.status).toBe(400);
    }
  });

  it("future and pre-creation dates rejected → 400", async () => {
    const future = "2999-12-31";
    expect((await putDate(token, habitId, future)).status).toBe(400);
    const pre = "2000-01-01";
    expect((await putDate(token, habitId, pre)).status).toBe(400);
  });

  it("7. malformed habit id handled safely → 404", async () => {
    const res = await request(app).put("/api/habits/abc/completions").set("Authorization", `Bearer ${token}`).send({ date: TODAY });
    expect(res.status).toBe(404);
  });

  it("8. foreign habit → 404", async () => {
    const b = await registerUser("b@example.invalid");
    const bHabit = (await createHabit(b, "B", "BUILD")).body.habit.id;
    const res = await request(app)
      .put(`/api/habits/${bHabit}/completions`)
      .set("Authorization", `Bearer ${token}`)
      .send({ date: TODAY });
    expect(res.status).toBe(404);
  });

  it("9. nonexistent habit → 404", async () => {
    const res = await request(app).put("/api/habits/999999/completions").set("Authorization", `Bearer ${token}`).send({ date: TODAY });
    expect(res.status).toBe(404);
  });

  it("10. BREAK habit cannot receive BUILD completion → 400 INVALID_HABIT_TYPE", async () => {
    const breakHabit = (await createHabit(token, "Smoking", "BREAK")).body.habit.id;
    const res = await putDate(token, breakHabit, TODAY);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_HABIT_TYPE");
    expect(await prisma.habitCompletion.count({ where: { habitId: breakHabit } })).toBe(0);
  });
});

describe("completion delete", () => {
  let token: string;
  let habitId: number;
  beforeEach(async () => {
    token = await registerUser("a@example.invalid");
    habitId = (await createHabit(token, "Meditate", "BUILD")).body.habit.id;
    await putDate(token, habitId, TODAY); // create one
  });

  it("11. owner can remove completion → 204", async () => {
    const res = await request(app)
      .delete(`/api/habits/${habitId}/completions/${TODAY}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);
    expect(await prisma.habitCompletion.count({ where: { habitId } })).toBe(0);
  });

  it("12. repeated delete is idempotent → 204 both times", async () => {
    const del = () =>
      request(app).delete(`/api/habits/${habitId}/completions/${TODAY}`).set("Authorization", `Bearer ${token}`);
    expect((await del()).status).toBe(204);
    expect((await del()).status).toBe(204);
  });

  it("13. foreign habit delete → 404", async () => {
    const b = await registerUser("b@example.invalid");
    const bHabit = (await createHabit(b, "B", "BUILD")).body.habit.id;
    const res = await request(app)
      .delete(`/api/habits/${bHabit}/completions/${TODAY}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("14. BREAK habit cannot use completion delete → 400", async () => {
    const breakHabit = (await createHabit(token, "Smoking", "BREAK")).body.habit.id;
    const res = await request(app)
      .delete(`/api/habits/${breakHabit}/completions/${TODAY}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_HABIT_TYPE");
  });
});

describe("break relapses", () => {
  let token: string;
  let habitId: number;
  beforeEach(async () => {
    token = await registerUser("a@example.invalid");
    habitId = (await createHabit(token, "Smoking", "BREAK")).body.habit.id;
  });

  it("15. no token → 401", async () => {
    const res = await request(app).post(`/api/habits/${habitId}/relapses`).send({ relapseDate: TODAY });
    expect(res.status).toBe(401);
  });

  it("16/17. owner records relapse on BREAK habit, DATE semantics → 201", async () => {
    const res = await request(app)
      .post(`/api/habits/${habitId}/relapses`)
      .set("Authorization", `Bearer ${token}`)
      .send({ relapseDate: TODAY });
    expect(res.status).toBe(201);
    expect(res.body.relapse.habitId).toBe(habitId);
    expect(res.body.relapse.relapseDate).toBe(TODAY);
    const rows = await prisma.relapseEvent.findMany({ where: { habitId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].relapseDate.toISOString().slice(0, 10)).toBe(TODAY);
  });

  it("18. invalid calendar date rejected → 400", async () => {
    const res = await request(app)
      .post(`/api/habits/${habitId}/relapses`)
      .set("Authorization", `Bearer ${token}`)
      .send({ relapseDate: "2026-02-30" });
    expect(res.status).toBe(400);
  });

  it("19. foreign habit → 404", async () => {
    const b = await registerUser("b@example.invalid");
    const bHabit = (await createHabit(b, "B", "BREAK")).body.habit.id;
    const res = await request(app)
      .post(`/api/habits/${bHabit}/relapses`)
      .set("Authorization", `Bearer ${token}`)
      .send({ relapseDate: TODAY });
    expect(res.status).toBe(404);
  });

  it("20. nonexistent habit → 404", async () => {
    const res = await request(app)
      .post("/api/habits/999999/relapses")
      .set("Authorization", `Bearer ${token}`)
      .send({ relapseDate: TODAY });
    expect(res.status).toBe(404);
  });

  it("21. BUILD habit cannot receive relapse → 400 INVALID_HABIT_TYPE", async () => {
    const buildHabit = (await createHabit(token, "Meditate", "BUILD")).body.habit.id;
    const res = await request(app)
      .post(`/api/habits/${buildHabit}/relapses`)
      .set("Authorization", `Bearer ${token}`)
      .send({ relapseDate: TODAY });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_HABIT_TYPE");
  });

  it("22. duplicate same-date relapse → 201 then 200, one row (contract idempotent)", async () => {
    const post = () =>
      request(app).post(`/api/habits/${habitId}/relapses`).set("Authorization", `Bearer ${token}`).send({ relapseDate: TODAY });
    expect((await post()).status).toBe(201);
    expect((await post()).status).toBe(200);
    expect(await prisma.relapseEvent.count({ where: { habitId } })).toBe(1);
  });

  it("23. no daily CLEAN rows created for BREAK", async () => {
    await request(app)
      .post(`/api/habits/${habitId}/relapses`)
      .set("Authorization", `Bearer ${token}`)
      .send({ relapseDate: TODAY });
    expect(await prisma.habitCompletion.count({ where: { habitId } })).toBe(0);
  });
});

async function putDate(token: string, habitId: number, date: string) {
  return request(app).put(`/api/habits/${habitId}/completions`).set("Authorization", `Bearer ${token}`).send({ date });
}
