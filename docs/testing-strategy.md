# Habit Shaper — Testing Strategy

> Tests are organized around business risk. Backend tests: **Vitest + Supertest**
> against the real Express app + a test MySQL database (spun up as part of the
> compose test setup). Frontend: minimal smoke tests (build + render), no heavy
> component-testing framework needed.

---

## 1. Auth

| Case | Expectation |
|---|---|
| Successful registration | 201, user created, token returned |
| Duplicate email | 409 `CONFLICT` |
| Valid login | 200, token returned |
| Wrong password | 401 |
| Unknown email | 401 (same message as wrong password — no enumeration) |
| Protected route without token | 401 |
| Protected route with expired/invalid token | 401 |
| `/auth/me` returns the user for a valid token | 200 + correct id |
| User A cannot access User B data | 404 on B's habit/goal ids with A's token (see Ownership) |

## 2. Build Habit

| Case | Expectation |
|---|---|
| Create build habit | 201, type=BUILD |
| Complete a date (first time) | 201, row stored |
| Repeat same-date completion (idempotent) | 200, no duplicate row, state unchanged (D2) |
| 1-day streak (reference date completed) | currentStreak = 1 |
| Multi-day streak (refDate + previous day) | currentStreak = 2 |
| Missing a past day resets streak | gap → streak counts only the run ending at refDate |
| **Reference date not completed** | streak still counts run ending the day before (D1 — not reset) |
| Complete future date | 400 |
| Complete before habit creation | 400 `BEFORE_CREATION` |
| Weekly completed count | counts only eligible elapsed days this week |
| Weekly missed count | eligible elapsed − completed; future dates excluded (D3) |
| Stats with explicit refDate | computed against refDate (D8) |
| Stats missing refDate | 400 (no server-clock fallback, D8) |
| Completion on BREAK habit | 400 `INVALID_HABIT_TYPE` |

## 3. Break Habit

| Case | Expectation |
|---|---|
| Create break habit | 201, type=BREAK |
| Initial clean streak | days since creation (no relapses) |
| Clean streak increases over days | grows by 1 per elapsed day |
| Single relapse resets streak | after relapse, streak restarts from day 1 next day |
| Multiple relapses | each resets; latest relapse governs |
| Relapse on reference date | cleanStreak = 0 that day; Day 1 next day |
| First day after relapse | cleanStreak = 1 |
| Repeat same-date relapse (idempotent) | 200, no duplicate row, state unchanged (D5) |
| Relapse on BUILD habit | 400 `INVALID_HABIT_TYPE` |
| Future relapse date | 400 |

## 4. Goals

| Case | Expectation |
|---|---|
| Create goal with own habit | 201, habit embedded |
| Create goal without habitId | 400 (habitId required) |
| Create goal linked to another user's habit | 404 (uniform hiding, D7) |
| Create goal linked to nonexistent habit | 404 `NOT_FOUND` |
| Edit title/description | 200, updated fields |
| Edit habitId to another user's habit | 404 |
| Delete goal | 204 |
| Delete another user's goal | 404 (owned-scoped read) |
| Goal habit delete cascades | deleting the habit deletes linked goals (FK CASCADE) |

## 5. Ownership / Isolation (D7 — uniform 404)

| Case | Expectation |
|---|---|
| User A lists habits | only A's habits |
| User A GET /habits/:id of B's habit | 404 |
| User A PUT completion on B's habit | 404 |
| User A POST relapse on B's habit | 404 |
| User A GET/PATCH/DELETE B's goal | 404 |
| User A create goal with B's habitId | 404 |

## 6. Docker (final clean-room smoke)

Run on a machine with only Docker installed, from a clean clone:

1. `docker compose down -v` (pristine)
2. `docker compose up --build -d`
3. DB healthcheck → `mysqladmin ping` OK; schema bootstraps automatically
4. Backend `/api/health` → `{ "status": "ok", "db": "up" }`
5. Frontend :3000 → 200 HTML; SPA loads
5. E2E via API: register → create habit → complete (local date) → stats (refDate) → relapse → goal
6. `docker compose down` (stop) → `docker compose up -d` (start, data persists)
7. `docker compose down -v && docker compose up -d` (reset path, R24) → fresh DB

## 7. What Is NOT Tested (deliberately)

- No load/performance tests (local test app).
- No visual/regression snapshot tests (no chart lib, minimal UI).
- No E2E browser automation (Playwright) — out of scope for a 3-day test;
  the API E2E in §6 plus manual browser pass covers the acceptance surface.
