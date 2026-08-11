# Habit Shaper — Task Breakdown (3-Day Plan)

> Implementation plan. Each phase = objective, dependencies, planned files,
> acceptance criteria, verification, suggested commit message.
> Commits are meaningful milestones — no fake commits, no squashing, no force-push.

---

## Phase 0 — Planning (THIS SESSION, DONE)

- **Objective:** pre-flight, repo bootstrap, planning docs, first commit, private repo.
- **Files:** `docs/*.md` (7 documents).
- **Acceptance:** planning committed before any source code (R27).
- **Commit:** `docs: add initial architecture and implementation plan`
- **Status:** in progress — commit blocked on repo-local Git identity approval.

---

## Phase 1 — Repository / Infrastructure

- **Objective:** compose topology + env scaffolding, health endpoint, empty-but-building services.
- **Dependencies:** Phase 0 (planning reviewed).
- **Planned files:**
  - `compose.yml` — db/backend/frontend services, healthchecks, named volume, port 3000
  - `.env.example` — DATABASE_URL, JWT_SECRET, PORT (placeholders)
  - `.gitignore` — node_modules, dist, .env, *.log
  - `backend/` scaffold: `package.json`, `tsconfig.json`, `src/server.ts` (health only)
  - `frontend/` scaffold: `package.json`, `vite.config.ts`, `index.html`, `src/main.tsx` (hello-world)
  - `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`
- **Acceptance:** `docker compose up` builds; backend `/api/health` OK; frontend serves at :3000.
- **Verification:** clean-room compose up (Phase 11 repeats it as the final gate).
- **Commit:** `chore: scaffold monorepo, compose topology, and health endpoint`

---

## Phase 2 — Database + Migrations

- **Objective:** Prisma schema matching `data-model.md`, first migration committed.
- **Dependencies:** Phase 1.
- **Planned files:** `backend/prisma/schema.prisma`, `backend/prisma/migrations/0001_init/`
- **Acceptance:** `prisma migrate deploy` against a fresh MySQL creates all 5 tables +
  unique constraints + FKs; `prisma migrate status` clean.
- **Verification:** `docker compose exec backend npx prisma migrate status`; test in Phase 10.
- **Commit:** `feat(db): prisma schema and initial migration`

---

## Phase 3 — Authentication

- **Objective:** register/login/me + JWT middleware + Zod schemas.
- **Dependencies:** Phase 2.
- **Planned files:** `backend/src/routes/auth.ts`, `backend/src/services/auth.ts`,
  `backend/src/middleware/auth.ts`, `backend/src/middleware/errorHandler.ts`,
  `backend/src/lib/jwt.ts`, `backend/src/lib/validation.ts`
- **Acceptance:** register/login/me work via curl; duplicate email 409; wrong password 401;
  protected routes 401 without token.
- **Verification:** curl sequence + Phase 10 tests.
- **Commit:** `feat(auth): register, login, and JWT middleware`

---

## Phase 4 — Habit Domain / Backend

- **Objective:** habits CRUD (create/list/detail) with ownership scoping; type validation.
- **Dependencies:** Phase 3.
- **Planned files:** `backend/src/routes/habits.ts`, `backend/src/services/habits.ts`
- **Acceptance:** create BUILD/BREAK habit; list shows only own habits; detail 404s on
  foreign habit (uniform 404, D7); type mismatch rejected.
- **Verification:** curl + Phase 10 tests.
- **Commit:** `feat(habits): create, list, and detail with ownership scoping`

---

## Phase 5 — Streak / Statistics Algorithms

- **Objective:** pure stats service implementing D1–D5 derivation rules; client-supplied reference date (D8).
- **Dependencies:** Phase 4.
- **Planned files:** `backend/src/services/stats.ts` (pure functions: `currentStreak`,
  `weeklyStats`, `cleanStreak`), `backend/src/lib/dates.ts` (naive date utils)
- **Acceptance:** completions PUT (idempotent, D2) + relapses POST + stats GET wired;
  edge cases (unfinished refDate, future dates, pre-creation dates, relapse on refDate)
  behave per data-model.md §4.
- **Verification:** unit tests for the pure functions (Phase 10), curl spot-checks.
- **Commit:** `feat(stats): streak, weekly, and clean-streak derivation`

---

## Phase 6 — Goal Management

- **Objective:** goals CRUD + habit link + ownership checks.
- **Dependencies:** Phase 4 (habits), Phase 3 (auth).
- **Planned files:** `backend/src/routes/goals.ts`, `backend/src/services/goals.ts`
- **Acceptance:** create/edit/delete goal; habitId must be caller's own (404, D7);
  goal list embeds habit.
- **Verification:** curl + Phase 10 tests.
- **Commit:** `feat(goals): CRUD with habit linking and ownership checks`

---

## Phase 7 — Frontend Auth

- **Objective:** login/register pages, token storage, route guard, API client.
- **Dependencies:** Phase 3 (API ready).
- **Planned files:** `frontend/src/api/client.ts`, `frontend/src/pages/Login.tsx`,
  `frontend/src/pages/Register.tsx`, `frontend/src/context/AuthContext.tsx`,
  `frontend/src/components/ProtectedRoute.tsx`, `frontend/src/lib/date.ts`
  (local `YYYY-MM-DD` helper — the single source of the client-supplied date, D8)
- **Acceptance:** register → auto-login → dashboard; reload keeps session; logout works.
- **Verification:** manual browser flow.
- **Commit:** `feat(frontend): auth pages, session storage, and route guard`

---

## Phase 8 — Frontend Habit Dashboard / Tracking

- **Objective:** habit list + create form, habit detail with daily completion
  (BUILD) and relapse button (BREAK), streak/weekly display.
- **Dependencies:** Phase 4, 5, 7.
- **Planned files:** `frontend/src/pages/Habits.tsx`, `frontend/src/pages/HabitDetail.tsx`,
  `frontend/src/pages/Dashboard.tsx`, `frontend/src/components/StreakBadge.tsx`,
  `frontend/src/components/CompletionCalendar.tsx` (last-14-days strip — no chart lib, R-ED)
- **Acceptance:** end-to-end: create habit → complete today (frontend local date) →
  streak updates; relapse → clean streak resets.
- **Verification:** manual E2E in browser + Phase 10 tests.
- **Commit:** `feat(frontend): habit dashboard, daily completion, and relapse UI`

---

## Phase 9 — Frontend Goals

- **Objective:** goals list + create/edit/delete UI with habit picker.
- **Dependencies:** Phase 6, 8.
- **Planned files:** `frontend/src/pages/Goals.tsx`, `frontend/src/components/GoalForm.tsx`
- **Acceptance:** CRUD goals linked to own habits; foreign habits not selectable.
- **Verification:** manual browser flow.
- **Commit:** `feat(frontend): goal management UI`

---

## Phase 10 — Tests & Edge Cases

- **Objective:** automated coverage of `testing-strategy.md`.
- **Dependencies:** Phases 3–6 (backend), 7–9 (frontend optional smoke).
- **Planned files:** `backend/tests/*.test.ts` (Vitest + Supertest against a test DB
  spun up in compose), `frontend/src/**/*.test.tsx` (minimal component tests).
- **Acceptance:** auth suite, build-habit suite, break-habit suite, goals suite,
  ownership suite all green.
- **Verification:** `npm test` in backend container.
- **Commit:** `test: cover auth, streaks, relapses, goals, and ownership`

---

## Phase 11 — Docker Clean-Room Verification

- **Objective:** prove `docker compose up` works from a pristine state.
- **Dependencies:** Phases 1–10.
- **Steps:** stop all → `docker compose down -v` (fresh volume) → `docker compose up
  --build -d` → wait for healthchecks → verify: DB bootstrapped (no manual migration),
  backend ready, frontend :3000 reachable, register → habit → completion → relapse →
  goal end-to-end → `docker compose down -v && up` again (reset path, R24).
- **Acceptance:** all gates pass from clean state with only Docker installed.
- **Commit:** `chore: verify clean-room docker compose bootstrap`

---

## Phase 12 — README + Submission Verification

- **Objective:** final README, `.env.example`, secrets audit, repo hygiene.
- **Dependencies:** Phase 11.
- **Planned files:** `README.md` (env vars, start/stop, DB reset, URLs, test commands),
  `.env.example` (final), `.gitignore` (final)
- **Acceptance:** README commands match clean-room results; `git grep` secrets scan
  clean; remote is private; history meaningful (R25, R26, R28).
- **Verification:** full checklist from the brief (final verification list).
- **Commit:** `docs: finalize README and submission documentation`
- **Post-approval only:** invite reviewers (karol, darwin, dedy @datasaur.ai).

---

## Commit Sequence (planned, meaningful)

```
docs: add initial architecture and implementation plan          (Phase 0)
chore: scaffold monorepo, compose topology, and health endpoint (Phase 1)
feat(db): prisma schema and initial migration                   (Phase 2)
feat(auth): register, login, and JWT middleware                 (Phase 3)
feat(habits): create, list, and detail with ownership scoping   (Phase 4)
feat(stats): streak, weekly, and clean-streak derivation        (Phase 5)
feat(goals): CRUD with habit linking and ownership checks       (Phase 6)
feat(frontend): auth pages, session storage, and route guard    (Phase 7)
feat(frontend): habit dashboard, daily completion, and relapse UI (Phase 8)
feat(frontend): goal management UI                              (Phase 9)
test: cover auth, streaks, relapses, goals, and ownership       (Phase 10)
chore: verify clean-room docker compose bootstrap               (Phase 11)
docs: finalize README and submission documentation              (Phase 12)
```

No squashing. No force-push. Each commit is an independent, reviewable milestone.
