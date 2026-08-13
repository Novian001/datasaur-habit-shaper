import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { currentStreak, weeklyStats, cleanStreak } from "../src/services/stats.js";

// Fixed calendar dates (no server clock anywhere — D8). Week of 2026-08-17:
// Mon 17, Tue 18, Wed 19, Thu 20, Fri 21, Sat 22, Sun 23.
const PASS = "testpass123";

// ---- pure function tests (deterministic: startDate + refDate + event rows) ----

describe("currentStreak (D1)", () => {
  it("1. one completion on refDate → streak 1", () => {
    expect(currentStreak("2026-08-17", "2026-08-17", ["2026-08-17"])).toBe(1);
  });

  it("2. consecutive completion days → correct streak", () => {
    const dates = ["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21"];
    expect(currentStreak("2026-08-17", "2026-08-21", dates)).toBe(5);
  });

  it("3. missed past day resets streak", () => {
    // Mon✓ Tue✓ Wed✗ Thu✓ Fri✓ → 2 (Thu+Fri), missed Wed breaks at Wed.
    const dates = ["2026-08-17", "2026-08-18", "2026-08-20", "2026-08-21"];
    expect(currentStreak("2026-08-17", "2026-08-21", dates)).toBe(2);
  });

  it("4. unfinished refDate preserves streak through yesterday", () => {
    // Mon✓ Tue✓ Wed✓ Thu✓ Fri unfinished → 4 (through Thu).
    const dates = ["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20"];
    expect(currentStreak("2026-08-17", "2026-08-21", dates)).toBe(4);
  });

  it("5. unfinished refDate after a missed yesterday → streak 0", () => {
    // Mon✓ Tue✓ Wed✓ Thu✗ Fri unfinished → 0 (Thu is a missed PAST day).
    const dates = ["2026-08-17", "2026-08-18", "2026-08-19"];
    expect(currentStreak("2026-08-17", "2026-08-21", dates)).toBe(0);
  });

  it("6. streak stops at habit.startDate", () => {
    // Habit starts Wed; Mon/Tue completions are impossible, must not count.
    const dates = ["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20"];
    expect(currentStreak("2026-08-19", "2026-08-20", dates)).toBe(2);
  });

  it("7. completion before startDate cannot influence streak", () => {
    // A stray row before startDate (defensive) is ignored — lower bound holds.
    const dates = ["2026-08-10", "2026-08-17", "2026-08-18", "2026-08-19"];
    expect(currentStreak("2026-08-17", "2026-08-19", dates)).toBe(3);
  });
});

describe("weeklyStats (D3)", () => {
  it("8. Monday-Sunday boundary correct", () => {
    // refDate Sunday → whole week eligible; completed Mon,Wed,Fri.
    const dates = ["2026-08-17", "2026-08-19", "2026-08-21"];
    expect(weeklyStats("2026-08-17", "2026-08-23", dates)).toEqual({
      weekCompleted: 3,
      weekElapsedDays: 7,
      weekCompletionRate: 3 / 7,
      missedDays: 4,
    });
  });

  it("9. future days do not count as missed", () => {
    // refDate Wednesday → only Mon..Wed eligible (future Thu..Sun not missed).
    const dates = ["2026-08-17"];
    expect(weeklyStats("2026-08-17", "2026-08-19", dates)).toEqual({
      weekCompleted: 1,
      weekElapsedDays: 3,
      weekCompletionRate: 1 / 3,
      missedDays: 2,
    });
  });

  it("10. days before habit start do not count", () => {
    // Habit starts Thursday; Monday..Wednesday not eligible.
    const dates = ["2026-08-20"];
    expect(weeklyStats("2026-08-20", "2026-08-21", dates)).toEqual({
      weekCompleted: 1,
      weekElapsedDays: 2,
      weekCompletionRate: 1 / 2,
      missedDays: 1,
    });
  });

  it("11. eligibleDays correct", () => {
    expect(weeklyStats("2026-08-17", "2026-08-19", []).weekElapsedDays).toBe(3);
    expect(weeklyStats("2026-08-19", "2026-08-21", []).weekElapsedDays).toBe(3); // start mid-week
  });

  it("12. completedDays correct", () => {
    expect(weeklyStats("2026-08-17", "2026-08-23", ["2026-08-17", "2026-08-21"]).weekCompleted).toBe(2);
  });

  it("13. missedDays correct", () => {
    expect(weeklyStats("2026-08-17", "2026-08-23", ["2026-08-17", "2026-08-21"]).missedDays).toBe(5);
  });

  it("14. completionRate correct", () => {
    expect(weeklyStats("2026-08-17", "2026-08-19", ["2026-08-17"]).weekCompletionRate).toBeCloseTo(1 / 3);
  });

  it("15. startDate mid-week correct", () => {
    // Habit starts Wed; refDate Fri. Wed✓ Thu✗ Fri✓ → 2/3.
    const dates = ["2026-08-19", "2026-08-21"];
    expect(weeklyStats("2026-08-19", "2026-08-21", dates)).toEqual({
      weekCompleted: 2,
      weekElapsedDays: 3,
      weekCompletionRate: 2 / 3,
      missedDays: 1,
    });
  });

  it("16. refDate Monday correct", () => {
    // refDate Monday → eligible is just Monday (startDate Monday).
    expect(weeklyStats("2026-08-17", "2026-08-17", ["2026-08-17"])).toEqual({
      weekCompleted: 1,
      weekElapsedDays: 1,
      weekCompletionRate: 1,
      missedDays: 0,
    });
  });

  it("17. full elapsed week scenario correct", () => {
    // Habit starts Monday; refDate Sunday; completed Mon,Tue,Wed,Thu,Fri.
    const dates = ["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21"];
    expect(weeklyStats("2026-08-17", "2026-08-23", dates)).toEqual({
      weekCompleted: 5,
      weekElapsedDays: 7,
      weekCompletionRate: 5 / 7,
      missedDays: 2,
    });
  });
});

describe("cleanStreak (D4, D5)", () => {
  it("18. new BREAK habit clean streak follows approved start-day semantics (startDate = Day 1)", () => {
    // startDate Monday, refDate Monday, no relapses → 1 (inclusive, D5).
    expect(cleanStreak("2026-08-17", "2026-08-17", [])).toEqual({ cleanStreak: 1, lastRelapseDate: null });
  });

  it("19. no relapse → streak increases by calendar days", () => {
    expect(cleanStreak("2026-08-17", "2026-08-19", []).cleanStreak).toBe(3);
    expect(cleanStreak("2026-08-17", "2026-08-23", []).cleanStreak).toBe(7);
  });

  it("20. relapse on refDate → 0", () => {
    expect(cleanStreak("2026-08-17", "2026-08-19", ["2026-08-19"])).toEqual({ cleanStreak: 0, lastRelapseDate: "2026-08-19" });
  });

  it("21. day after relapse → 1", () => {
    expect(cleanStreak("2026-08-17", "2026-08-20", ["2026-08-19"])).toEqual({ cleanStreak: 1, lastRelapseDate: "2026-08-19" });
    expect(cleanStreak("2026-08-17", "2026-08-21", ["2026-08-19"]).cleanStreak).toBe(2);
  });

  it("22. multiple relapses → last relevant relapse wins", () => {
    // Relapses Wed and Fri; refDate Saturday → 1 day since Friday.
    expect(cleanStreak("2026-08-17", "2026-08-22", ["2026-08-19", "2026-08-21"])).toEqual({
      cleanStreak: 1,
      lastRelapseDate: "2026-08-21",
    });
  });

  it("23. relapse before refDate boundary handled correctly", () => {
    // Relapse Sunday of previous week; refDate next Monday → 1.
    expect(cleanStreak("2026-08-10", "2026-08-17", ["2026-08-16"])).toEqual({ cleanStreak: 1, lastRelapseDate: "2026-08-16" });
  });

  it("24. startDate lower bound honored", () => {
    // Relapse before startDate (defensive stray row) ignored; refDate Friday →
    // 5 inclusive days from Monday start.
    expect(cleanStreak("2026-08-17", "2026-08-21", ["2026-08-10"])).toEqual({ cleanStreak: 5, lastRelapseDate: null });
  });
});

// ---- API-level tests: validation, ownership, wire shape ----

const START = "2026-08-17"; // Monday

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

describe("stats API validation and ownership", () => {
  let token: string;
  beforeEach(async () => {
    token = await registerUser("a@example.invalid");
  });

  it("25. missing refDate → 400", async () => {
    const h = await createHabit(token, "M", "BUILD");
    const res = await request(app).get(`/api/habits/${h.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("26. malformed refDate → 400", async () => {
    const h = await createHabit(token, "M", "BUILD");
    for (const bad of ["not-a-date", "2026-13-01", "2026-02-30"]) {
      const res = await request(app).get(`/api/habits/${h.id}?refDate=${bad}`).set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(400);
    }
  });

  it("27. future startDate: refDate before startDate → 200 with zero stats (no 400)", async () => {
    // Future-start habit: startDate 2026-08-19, refDate 2026-08-18 (before start).
    const h = await createHabit(token, "M", "BUILD", "2026-08-19");
    const res = await request(app).get(`/api/habits/${h.id}?refDate=2026-08-18`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.stats.currentStreak).toBe(0);
    expect(res.body.stats.weekCompleted).toBe(0);
    expect(res.body.stats.weekElapsedDays).toBe(0);
    expect(res.body.stats.weekCompletionRate).toBe(0);
    expect(res.body.stats.missedDays).toBe(0);
  });

  it("28. past startDate still valid: BREAK startDate 2026-08-10, refDate 2026-08-13, no relapse → cleanStreak 4", async () => {
    const h = await createHabit(token, "B", "BREAK", "2026-08-10");
    const res = await request(app).get(`/api/habits/${h.id}?refDate=2026-08-13`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.stats.cleanStreak).toBe(4);
    expect(res.body.stats.lastRelapseDate).toBeNull();
  });

  it("29. future BREAK: startDate 2026-08-15, refDate 2026-08-13 → cleanStreak 0, no error", async () => {
    const h = await createHabit(token, "B", "BREAK", "2026-08-15");
    const res = await request(app).get(`/api/habits/${h.id}?refDate=2026-08-13`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.stats.cleanStreak).toBe(0);
    expect(res.body.stats.lastRelapseDate).toBeNull();
  });

  it("30. future BUILD: startDate 2026-08-15, refDate 2026-08-13 → streak 0, missed 0, no pre-start eligible days", async () => {
    const h = await createHabit(token, "M", "BUILD", "2026-08-15");
    const res = await request(app).get(`/api/habits/${h.id}?refDate=2026-08-13`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.stats.currentStreak).toBe(0);
    expect(res.body.stats.weekCompleted).toBe(0);
    expect(res.body.stats.weekElapsedDays).toBe(0);
    expect(res.body.stats.weekCompletionRate).toBe(0);
    expect(res.body.stats.missedDays).toBe(0);
  });

  it("31. list with active + future-start habit → 200, both returned", async () => {
    await createHabit(token, "Active", "BUILD", "2026-08-10");
    await createHabit(token, "Future", "BUILD", "2026-08-15");
    const res = await request(app).get("/api/habits?refDate=2026-08-13").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const names = res.body.habits.map((x: { name: string }) => x.name);
    expect(names).toContain("Active");
    expect(names).toContain("Future");
  });

  it("32. foreign habit → 404 (D7 uniform hiding)", async () => {
    const b = await registerUser("b@example.invalid");
    const bHabit = await createHabit(b, "B", "BUILD");
    const res = await request(app).get(`/api/habits/${bHabit.id}?refDate=2026-08-21`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("29. nonexistent habit → 404", async () => {
    const res = await request(app).get("/api/habits/999999?refDate=2026-08-21").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("30. no token → 401", async () => {
    const res = await request(app).get("/api/habits/1?refDate=2026-08-21");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("stats API response shapes", () => {
  let token: string;
  beforeEach(async () => {
    token = await registerUser("a@example.invalid");
  });

  it("BUILD detail returns streak/week stats + completedDates (contract §2)", async () => {
    const h = await createHabit(token, "Meditate", "BUILD");
    const put = (d: string) =>
      request(app)
        .put(`/api/habits/${h.id}/completions`)
        .set("Authorization", `Bearer ${token}`)
        .send({ date: d, refDate: d });
    await put("2026-08-17"); // Mon
    await put("2026-08-18"); // Tue
    await put("2026-08-19"); // Wed
    await put("2026-08-21"); // Fri (Thu missed)

    const res = await request(app).get(`/api/habits/${h.id}?refDate=2026-08-21`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    // Mon..Wed consecutive, Thu missed, Fri completed → streak = 1 (only Fri,
    // the missed Thu breaks the run).
    expect(res.body.stats).toEqual({
      currentStreak: 1,
      weekCompleted: 4,
      weekElapsedDays: 5,
      weekCompletionRate: 4 / 5,
      missedDays: 1,
    });
    // Newest-first, matching relapseDates and the contract's UI calendar strip.
    expect(res.body.completedDates).toEqual(["2026-08-21", "2026-08-19", "2026-08-18", "2026-08-17"]);
    expect(res.body.habit.name).toBe("Meditate");
  });

  it("BREAK detail returns cleanStreak + lastRelapseDate + relapseDates (contract §2)", async () => {
    const h = await createHabit(token, "Smoking", "BREAK");
    const post = (d: string) =>
      request(app)
        .post(`/api/habits/${h.id}/relapses`)
        .set("Authorization", `Bearer ${token}`)
        .send({ relapseDate: d, refDate: d });
    await post("2026-08-19"); // Wed relapse

    const res = await request(app).get(`/api/habits/${h.id}?refDate=2026-08-22`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.stats).toEqual({ cleanStreak: 3, lastRelapseDate: "2026-08-19" });
    expect(res.body.relapseDates).toEqual(["2026-08-19"]);
  });

  it("BREAK cleanStreak on relapse day = 0 (D5) via API", async () => {
    const h = await createHabit(token, "Smoking", "BREAK");
    await request(app)
      .post(`/api/habits/${h.id}/relapses`)
      .set("Authorization", `Bearer ${token}`)
      .send({ relapseDate: "2026-08-21", refDate: "2026-08-21" });
    const res = await request(app).get(`/api/habits/${h.id}?refDate=2026-08-21`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.stats.cleanStreak).toBe(0);
  });

  it("GET /habits list includes per-habit stats (contract §2)", async () => {
    await createHabit(token, "Meditate", "BUILD");
    const res = await request(app).get("/api/habits?refDate=2026-08-17").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.habits).toHaveLength(1);
    expect(res.body.habits[0].stats).toEqual({
      currentStreak: 0,
      weekCompleted: 0,
      weekElapsedDays: 1,
      weekCompletionRate: 0,
      missedDays: 1,
    });
  });

  it("list GET without refDate → 400", async () => {
    const res = await request(app).get("/api/habits").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});
