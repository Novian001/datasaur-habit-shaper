# Habit Shaper — Project Documentation

## Project Overview

Web application for building positive habits and breaking negative ones.
Tracks daily completion streaks (BUILD), clean streaks (BREAK with relapse events), weekly completion rates, and goals linked to habits. Full-stack TypeScript, Docker-orchestrated, runs from repo root with a single `docker compose up --build`.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Vite, jsdom + Testing Library |
| Backend | Node.js + TypeScript, Express, Prisma ORM |
| Database | MySQL 8 |
| Container | Docker Compose (3 services), nginx (SPA + API proxy) |
| Testing | Vitest + Supertest (backend), Vitest + Testing Library (frontend) |
| Auth | JWT bearer (7d expiry), bcrypt password hashing |

## Architecture

```
Browser (localhost:3000)
   │
   ▼ nginx (static SPA + /api proxy)
┌────────────────────────┐
│ frontend (React/Vite)  │  serves built assets; proxies /api → backend:3000
└────────────┬───────────┘
             │ HTTP /api/*
             ▼
┌────────────────────────┐
│ backend (Express/TS)   │  REST API; business logic; Prisma → MySQL
└────────────┬───────────┘
             │
             ▼
┌────────────────────────┐
│ mysql:8 (db)           │  named volume db_data; prune on reset
└────────────────────────┘
```

Startup order enforced via compose healthchecks: `db` → `backend` (runs `prisma migrate deploy` then starts Express) → `frontend` (nginx).

## Domain Model

```
User
  id, email, passwordHash, createdAt
  └── Habit[] (CASCADE)
        ├── HabitCompletion[] (BUILD only, CASCADE)
        ├── RelapseEvent[] (BREAK only, CASCADE)
        └── Goal[] (CASCADE)

Goal
  id, userId, habitId, title, description, createdAt, updatedAt
```

Unique constraints: `users(email)`, `habit_completions(habit_id, date)`,
`relapse_events(habit_id, relapse_date)`.

## BUILD — DAILY

Default for BUILD habits. Consecutive completed calendar days.

**Streak:** walk backward from `refDate`. If `refDate` completed, start there; if not, skip to previous day. Count consecutive days ending at the cursor. An unfinished `refDate` never breaks yesterday's streak.

**Weekly:** Monday–Sunday week containing `refDate`. Eligible range = `[max(weekMonday, startDate), refDate]`. Future days and pre-start days excluded. `completionRate = completed / eligibleDays`. `missedDays = eligible - completed`.

## BUILD — TIMES_PER_WEEK

Flexible N-times-per-week extension. **Not part of the Datasaur coding test requirement** — it was added as a post-freeze feature.

- `frequencyType` enum: `DAILY` (default) or `TIMES_PER_WEEK`
- `weeklyTarget` nullable int 1–7 (required when `TIMES_PER_WEEK`)
- No fixed weekday pattern — any day counts
- BREAK habits silently ignore frequency (enforced: `TIMES_PER_WEEK` rejected at creation for BREAK)

**Stats fields returned for TIMES_PER_WEEK:**
- `weeklyCompleted` — completions in the current (incomplete) or last (closed) week
- `weeklyRemaining` — `max(0, weeklyTarget - weeklyCompleted)`
- `weeklyGoalReached` — `completed >= weeklyTarget`
- `weeklyCompletionRate` — `min(completed / weeklyTarget, 1.0)`
- `weeklyStreak` — consecutive successful completed weeks

**Weekly streak rules:**
- A week is **successful** when `completions >= weeklyTarget`
- A week is **closed** when its Sunday ≤ `refDate`
- A week is **in-progress** when `refDate < its Sunday`
- Current in-progress week doesn't contribute to the streak count until it reaches its target (early success counts immediately) or closes below target (breaks streak)
- Closed current week below target → streak breaks

**First partial week rule (neutral impossible first week):**
- If `daysAvailableInFirstPartialWeek >= weeklyTarget` → first week IS streak-eligible with the full target
- If `daysAvailableInFirstPartialWeek < weeklyTarget` → first partial week is **neutral** (does NOT increase streak, reset streak, or count as failed). Streak evaluation begins the following Monday.

**BREAK habits:** `TIMES_PER_WEEK` is rejected. Clean streak computed independently of frequency.

## BREAK

Relapse-only event model. **No daily clean button.** Clean days are inferred from absence of relapse events.

- No relapses: `cleanStreak = days from startDate to refDate inclusive` (startDate is Day 1)
- Relapse day: `cleanStreak = 0`; Day 1 restarts the next calendar day
- A relapse before `startDate` is ignored (meaningless history)
- Multiple relapses: latest one governs

## Date Semantics

All habit dates are naive `YYYY-MM-DD` calendar DATEs — no time, no timezone.

- `startDate` — business calendar boundary, client-supplied (browser local date at creation)
- `refDate` — client-supplied explicit reference "today" (frontend local date)
- `createdAt` — audit timestamp, never used for habit calendar semantics

**Future-start behavior:** `startDate > refDate` → habit hasn't started yet. Tracking is rejected. Stats return zero/empty. Future-start habits render as "not started" in the UI.

**Browser-local date:** frontend uses `new Date().getFullYear/getMonth/getDate` (not `toISOString`/UTC shift) to determine the local calendar date for `startDate`, `refDate`, completions, and relapses.

## Authentication

- `POST /api/auth/register` — email + password (min 8 chars), bcrypt hash, returns `{ user, token }`
- `POST /api/auth/login` — returns `{ user, token }`; wrong email or password → same 401 message (no enumeration)
- `GET /api/auth/me` — returns `{ user }` for valid token
- Logout = remove JWT from `localStorage` + redirect
- JWT payload: `{ sub: userId, email }`, 7d expiry, signed with `JWT_SECRET`

## Ownership / Security

- Every query filters `userId = req.userId` (server-supplied from JWT)
- Foreign or nonexistent resource → uniform `404 NOT_FOUND` (no enumeration, no 403)
- `habitId` on goals validated for ownership before use
- Passwords never returned; `userId` never returned in response shapes

## Error Handling

| HTTP | Code | Trigger |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Zod validation failure or business rule violation |
| 401 | `UNAUTHORIZED` | Missing/invalid/expired token |
| 404 | `NOT_FOUND` | Resource missing OR belongs to another user |
| 409 | `CONFLICT` | Duplicate email |
| 500 | `INTERNAL_ERROR` | Unexpected; logged server-side |

Malformed JSON body → 400 `VALIDATION_ERROR` "Malformed JSON body".

## API Surface

All routes JSON. Auth routes require `Authorization: Bearer <token>`.

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | `200 { status, db }` |
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user |
| GET | `/api/habits?refDate=` | List habits with stats |
| POST | `/api/habits` | Create habit |
| GET | `/api/habits/:id?refDate=` | Habit detail + stats + history |
| PUT | `/api/habits/:id/completions` | Mark day complete (BUILD) |
| DELETE | `/api/habits/:id/completions/:date` | Undo completion |
| POST | `/api/habits/:id/relapses` | Record relapse (BREAK) |
| GET | `/api/goals` | List goals |
| POST | `/api/goals` | Create goal |
| PATCH | `/api/goals/:id` | Update goal |
| DELETE | `/api/goals/:id` | Delete goal |

Habit body optionally includes `frequency: { type: "DAILY" | "TIMES_PER_WEEK", target: 1-7 }`. Defaults to `DAILY` when absent.

## Frontend Flow

1. **Login** `/login` — email + password, error alert, loading state, redirect on success
2. **Register** `/register` — same pattern
3. **Dashboard** `/` — habit list with stats (streak/week for DAILY, weeklyStreak/goal for TPW), summary strip (total/BUILD/BREAK counts), done-today count, Create Habit button
4. **Habit Detail** `/habits/:id` — full stats, weekly progress, completed dates strip, Undo, Back link
5. **Goals** `/goals` — goal list with linked habit badges, Create/Edit/Delete with inline editing
6. **Create Habit modal** — name, type (BUILD/BREAK chip), optional frequency dropdown, startDate (min=today), submit
7. **Create Goal modal** — title, description (optional), habit selector

## Docker / Reviewer Flow

```sh
docker compose up --build
```

- App: http://localhost:3000
- Backend health (direct): http://localhost:3001/api/health

Schema bootstrap is automatic — `prisma migrate deploy` runs on backend container start (idempotent; no-op when schema is current).

Reset: `docker compose down -v && docker compose up -d`

## Database Migration

Three migrations applied in order:
1. `20260812002034_init_habit_schema` — users, habits, habit_completions, relapse_events, goals
2. `20260812060000_add_habit_start_date` — adds `start_date DATE NOT NULL` to habits
3. `20260825000000_add_frequency_type` — adds `frequency_type ENUM('DAILY','TIMES_PER_WEEK') NOT NULL DEFAULT 'DAILY'` and `weekly_target TINYINT UNSIGNED NULL` + range CHECK constraint (1–7)

## Testing

**Backend** (canonical runner): `docker compose -f compose.yml -f compose.test.yml run --rm backend-test`
→ **138/138 PASS** (Vitest + Supertest, real Express + test MySQL)

Test files: auth (15), goals (28), habits (18), stats (27), statsTPW (18), tracking (32)

**Frontend**: `cd frontend && npm test`
→ **47/47 PASS** (Vitest + jsdom + Testing Library)

Frontend test files: auth-flow (10), goals-flow (21), dashboard (16)
`npx tsc --noEmit` clean. `npm run build` clean.

**E2E smoke** (through nginx :3000): `bash hermes-verify-phase9-e2e.sh`
→ 26/26

## Original Requirement vs Extension

**Datasaur coding test requirements (original):**
- Register/login with email + password (no email verification)
- Create BUILD and BREAK habits
- Mark BUILD habits complete for each day
- Track consecutive completion streak for BUILD
- Track weekly completion rate for BUILD
- Track days missed per week for BUILD
- Track clean streak for BREAK
- Track Day 1, Day 2, Day 3 progression for BREAK
- Relapse events reset clean streak for BREAK
- Add/edit/remove goals linked to exactly one habit
- React frontend, Node/TS backend, MySQL database
- Docker Compose from repo root, automatic schema bootstrap
- Reviewer needs no local Node.js/MySQL/frontend tooling

**TIMES_PER_WEEK extension (post-freeze):**
- Flexible N-times-per-week BUILD habit option (1–7 per week, any day pattern)
- `frequencyType` (`DAILY`/`TIMES_PER_WEEK`) and `weeklyTarget` fields on habits
- Separate stats: `weeklyStreak`, `weeklyCompleted`, `weeklyRemaining`, `weeklyGoalReached`, `weeklyCompletionRate`
- Neutral impossible first partial week rule
- Closed failed week streak-break rule
- Early target reached counts immediately
- Rejected for BREAK habits

## AI-Assisted Development

Human-driven, AI-executed workflow:

1. **Requirement** — human defines the goal
2. **Investigate** — AI reads existing source, traces data flow, identifies affected files
3. **Implement** — AI writes code, preferring minimal diffs and existing patterns
4. **Positive test** — AI writes a passing test first (TDD where practical)
5. **Negative test** — AI writes edge/failure cases
6. **Regression** — AI runs full suite; if broken, binary-search to root cause
7. **Diff review** — AI shows only the changed lines; human approves before commit
8. **Commit** — AI stages explicitly (never `git add .`), human approves first commit per session

## Documentation Map

| File | Description |
|---|---|
| `README.md` | Quick start, features, architecture, tests, env vars |
| `docs/requirements-analysis.md` | Explicit requirements + engineering decisions |
| `docs/architecture.md` | System overview, components, Docker, startup sequence |
| `docs/data-model.md` | Tables, relations, derivation rules, open decisions |
| `docs/api-contract.md` | REST contract: paths, request/response shapes, errors |
| `docs/testing-strategy.md` | Test matrix per feature area |
| `docs/task-breakdown.md` | Phase log, dependencies, priorities |
| `docs/agentic-development.md` | Full phase log with decisions, verifications, corrections |
| `docs/project-documentation.md` | This file — current state after TIMES_PER_WEEK |