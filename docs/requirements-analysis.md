# Habit Shaper — Requirements Analysis

> Engineering analysis for the Datasaur.ai 3-day coding test.
> Every item is labeled **SOURCE REQUIREMENT** (explicitly required by the brief)
> or **ENGINEERING DECISION / ASSUMPTION** (proposed by engineering, pending human review).

---

## 1. Problem Summary

Build a lightweight web application called **Habit Shaper** that helps users:

1. **Build** positive habits (meditate, exercise, read, learn Mandarin)
2. **Break** negative habits (smoking, junk food, doomscrolling)
3. **Track** daily progress (streaks, weekly completion, missed days, clean streaks)
4. **Manage** goals, each linked to exactly one habit

The app is web-based, containerized, and must run from the repository root with a
single `docker compose up` — the reviewer needs only Docker + Docker Compose.

---

## 2. Explicit Requirements (SOURCE REQUIREMENT)

| ID | Requirement |
|----|-------------|
| R1 | Users can register with email + password (no email verification) |
| R2 | Users can log in with email + password |
| R3 | Users can create **build** habits |
| R4 | Users can mark a build habit as **completed for each day** |
| R5 | System tracks **consecutive completion streak** for build habits |
| R6 | System tracks **weekly completion rate** for build habits |
| R7 | System tracks **number of days missed per week** for build habits |
| R8 | Users can create **break** habits |
| R9 | System tracks **clean streak** for break habits |
| R10 | System tracks **day 1, day 2, day 3, …** progression for break habits |
| R11 | System tracks **relapse events**; a relapse **resets the clean streak** |
| R12 | Users can **add** goals |
| R13 | Users can **edit** goals |
| R14 | Users can **remove** goals |
| R15 | Every goal **must be linked to one habit** (build OR break type) |
| R16 | Frontend: **React** |
| R17 | Backend: **Node.js with TypeScript** |
| R18 | Database: **MySQL** |
| R19 | **Docker Compose** must run the entire app from repo root (`compose.yml`) |
| R20 | **Schema bootstrap automatic** on first boot — no manual migration step for reviewer |
| R21 | Reviewer needs **no local Node.js, MySQL, or frontend tooling** |
| R22 | Repository must be **PRIVATE** (Novian001/datasaur-habit-shaper) |
| R23 | Repo must contain `.env.example` (placeholders only) |
| R24 | `README.md` documents env vars, commands, start/stop, DB reset, URLs, test commands |
| R25 | No secrets, `.env`, keys, tokens, certificates, or build artifacts committed |
| R26 | Reviewers (karol/darwin/dedy @datasaur.ai) invited **only after final verification + explicit approval** |
| R27 | Development must be **agentic with visible planning** — planning committed **before** source code |
| R28 | Commit history must be meaningful milestones; **no history rewriting/force-push** |

---

## 3. Non-Requirements (explicitly out of scope)

Not required, and **deliberately NOT planned** unless core requirements finish early:

- Habit edit / delete (optional only after all required functionality works end-to-end)
- Social features, notifications, email verification, OAuth, password reset
- Achievements, gamification, charts libraries, calendar integrations, admin panel
- Next.js, NestJS, Redux, GraphQL, Redis, Kafka, microservices, Kubernetes,
  event sourcing, CQRS, cloud infrastructure
- Real-time features, PWA, mobile apps, i18n, dark mode

---

## 4. Ambiguities (identified, NOT silently assumed)

The brief leaves the following implementation details open. Each is resolved by an
explicit engineering decision below — none is presented as a recruiter requirement.

| # | Ambiguity | Source text gap |
|---|-----------|-----------------|
| A1 | What is the current build streak when *today* is not yet completed? | "consecutive completion streak" — no definition of whether an unfinished today breaks the streak |
| A2 | Is daily completion unique per habit+date? | "mark build habits as completed for each day" — no uniqueness statement |
| A3 | Weekly completion: week start, what counts as missed, future/creation-day handling | "weekly completion rate", "days missed per week" — no window or rule definition |
| A4 | Break habits: must the user log a "clean" day daily, or are clean days inferred? | "clean streaks" + "relapse events" — no explicit daily clean action required |
| A5 | On a relapse day, is the streak 0 and when does Day 1 restart? | "A relapse resets the clean streak" — reset semantics undefined |
| A6 | Goal model is underspecified (targets? deadlines?) | "add/edit/remove goals, linked to a habit" — nothing else |
| A7 | Data isolation between users | "track daily progress" — ownership model not stated |
| A8 | Dates/timezones for daily tracking | "each day" — naive vs timezone-aware undefined |

---

## 5. Proposed Assumptions (ENGINEERING DECISION / ASSUMPTION — pending human review)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Streak survives an unfinished today.** Current streak = consecutive completed days ending at yesterday (or today if today is completed). A not-yet-completed today does NOT break the streak. It only breaks when a *completed* past day is followed by a *missed* day (a calendar day that has passed, has no completion, and is not a future day). | Users complete habits at various points during the day; penalizing an in-progress day would cause spurious streak resets and nightly "streak lost" behavior. |
| D2 | **UNIQUE(habit_id, date)** for build completions — at most one completion state per habit+date. Completion marking is **idempotent**: `PUT` of an already-completed date succeeds without creating a duplicate row and without changing state, returning the existing completion. Consistent success status: **200 OK**. | One row per habit per day; the "per day" requirement enforced at the database level; PUT semantics honored — no 409. |
| D3 | **Week = Monday → Sunday, modeled with calendar DATE values only.** Missed = an eligible elapsed calendar date in `[habit.createdAtDate, referenceDate]` with no completion. Future dates (after the reference date) are never missed; dates before habit creation are never counted. Weekly denominator = eligible elapsed calendar days only. No timestamp boundaries, no UTC "week start instant" — the week is a range of DATEs. | Monday–Sunday is the documented convention; counting starts at habit creation; future days can never be "missed". |
| D4 | **BREAK habits are event-based: relapse events stored, clean days inferred.** No daily "clean" button. Habit creation starts the clock; each relapse event resets the current clean streak; clean days are derived by counting consecutive days without relapse. | Matches the requirement text (only relapse is an explicit user action; a daily clean button would be an invented requirement and would add a second input mode for the same data). Tradeoff documented in `data-model.md` §6. |
| D5 | **Relapse-day semantics:** on the calendar date of a relapse, the clean streak is **0** and Day 1 restarts on the **next** calendar day (the first full day after the relapse with no relapse). If multiple relapses occur on the same date, the later one is ignored (UNIQUE(habit_id, relapse_date)). | Simple, matches "relapse resets the clean streak", unambiguous. |
| D6 | **Minimal goal model:** `id, user_id, habit_id, title, description (nullable), timestamps`. No targets/deadlines/priority. | The brief lists only add/edit/remove + habit link. Inventing targets/deadlines would be scope creep. |
| D7 | **Ownership — uniform hiding semantics:** every resource (habit, goal, tracking row, and the habit_id supplied on goal create/update) belonging to another user behaves as **NOT FOUND → 404** — never 403. All queries scoped by authenticated user_id; a resource that isn't the caller's is indistinguishable from one that doesn't exist. | One consistent rule across the API: no resource-existence leakage, no special 403 case. |
| D8 | **No server/container UTC clock for habit calendar semantics.** DATE-only values end-to-end. The **frontend** determines the user's local calendar date as `YYYY-MM-DD` and sends it explicitly: as the habit's `startDate` (local calendar boundary at creation), as `date`/`relapseDate` on daily actions, and as `refDate` for the not-future rule and stats. Backend validates the `YYYY-MM-DD` format, stores naive DATE, and never converts habit dates through UTC timestamps; `createdAt` is an audit timestamp, never a calendar date. Stats endpoints accept an explicit reference date. No timezone profiles/libraries. (Human-review correction 2026-08-12: `startDate` and `refDate` now explicit.) | Avoids TZ-shift bugs entirely; the user's own calendar day is authoritative for "today". Backend stays stateless w.r.t. dates. |

---

## 6. Acceptance Criteria

The app is accepted when, with only `docker compose up`:

1. MySQL starts, schema bootstraps automatically (Prisma migrate deploy on backend start)
2. Backend health endpoint returns OK
3. Frontend is reachable at the documented URL (http://localhost:3000)
4. A reviewer can register with email+password, log out, log back in
5. A reviewer can create a BUILD habit and mark days complete; streak, weekly completion rate, and missed days are displayed and correct per the documented rules (D1–D3)
6. A reviewer can create a BREAK habit, see the clean streak, record a relapse, and watch the streak reset and Day 1 restart (D4–D5)
7. A reviewer can create, edit, and delete goals, each linked to a habit they own
8. Two accounts cannot see or mutate each other's data — foreign resources behave as not found (D7)
9. `docker compose down -v && docker compose up` re-bootstraps cleanly (DB reset path documented)
10. `git log` shows the planning commit first, then meaningful milestone commits, no forced history

---

## 7. Requirement Traceability Matrix

Legend: **SR** = SOURCE REQUIREMENT, **ED** = ENGINEERING DECISION / ASSUMPTION.

| Requirement | Type | Backend/API responsibility | Frontend responsibility | Verification / test |
|---|---|---|---|---|
| R1 register email+password | SR | `POST /api/auth/register`; Zod-validate; bcrypt hash; insert user | Register form (email, password, confirm) | Test: register success; duplicate email 409 |
| R2 login email+password | SR | `POST /api/auth/login`; verify bcrypt; issue JWT | Login form; store token; logout clears it | Test: valid login 200; wrong password 401 |
| R3 create build habit | SR | `POST /api/habits` (type=BUILD) | "New habit" form (type toggle BUILD/BREAK) | Test: create build habit 201 |
| R4 | Mark build day complete | SR+ED(D2) | `PUT /api/habits/:id/completions` (body: date) — idempotent, 200 on repeat | Daily checkbox/button per date (frontend sends local date) | Test: complete date 200; repeat same date 200 idempotent, no duplicate |
| R5 | Consecutive completion streak | SR+ED(D1) | `GET /api/habits/:id/stats` (with reference date) → `currentStreak` computed from completion rows | Show "🔥 N day streak" | Test: 1-day, multi-day, missing-day reset, unfinished-today survives |
| R6 | Weekly completion rate | SR+ED(D3) | `GET /api/habits/:id/stats` → `weekCompletionRate` (completed / eligible elapsed days) | Show weekly rate | Test: counts only eligible elapsed, non-future days |
| R7 | Missed days per week | SR+ED(D3) | `GET /api/habits/:id/stats` → `missedDays` | Show missed count | Test: future dates and pre-creation dates not missed |
| R8 | Create break habit | SR | `POST /api/habits` (type=BREAK) | Same habit form | Test: create break habit 201 |
| R9 | Clean streak | SR+ED(D4) | `GET /api/habits/:id/stats` → `cleanStreak` derived from relapse events | Show clean streak | Test: initial streak grows; resets on relapse |
| R10 | Day 1,2,3 progression | SR+ED(D5) | `GET /api/habits/:id/stats` → `cleanStreak` + `relapseEvents` | Show "Day N" | Test: day 1 after relapse; streak count over days |
| R11 | Relapse resets clean streak | SR+ED(D5) | `POST /api/habits/:id/relapses` (body: date); UNIQUE(habit_id, relapse_date) | "Log relapse" button (frontend sends local date) | Test: single relapse resets; multiple relapses; same-day relapse idempotent/rejected |
| R12 | Add goal | SR | `POST /api/goals` (habit_id must belong to user) | Goal form (title, description, habit picker) | Test: create goal 201; foreign habit 404 |
| R13 | Edit goal | SR | `PATCH /api/goals/:id` (title, description, habit_id) | Edit form (pre-filled) | Test: edit 200; cross-user edit 404 |
| R14 | Remove goal | SR | `DELETE /api/goals/:id` | Delete button (confirm) | Test: delete 204; cross-user delete 404 |
| R15 | Goal linked to one habit | SR | FK habit_id NOT NULL; ownership check on habit (foreign → 404) | Habit picker required | Test: goal without habit rejected (400); habit of another user → 404 |
| R16 React frontend | SR | — | React 18 + Vite + TS + minimal CSS | Docker smoke test; build passes |
| R17 Node+TS backend | SR | Express 5 + TypeScript + Prisma | — | `tsc` build passes; `docker compose up` works |
| R18 MySQL | SR | Prisma → MySQL 8 (official image) | — | DB container healthy; schema bootstraps |
| R19 compose.yml at root | SR | Backend/frontend/DB services defined | — | `docker compose up` from clean tree (clean-room test) |
| R20 automatic schema bootstrap | SR+ED | Backend entrypoint runs `prisma migrate deploy` before `node dist/server.js` | — | Fresh volume → tables created automatically |
| R21 no local toolchain needed | SR | All in containers; npm ci inside images | — | Clean-room verify on a machine without Node/MySQL |
| R22 private repo | SR | — | — | `gh repo view --json visibility` = PRIVATE |
| R23 .env.example | SR | Placeholder values only | — | File review |
| R24 README | SR | — | — | Documented commands executed during clean-room verify |
| R25 no secrets committed | SR | — | — | `git grep` secrets check; .gitignore review |
| R26 reviewers invited only after approval | SR | — | — | `gh repo collaborators list` shows none until approved |
| R27 planning before code | SR | — | — | `git log` first commit = docs; code commits later |
| R28 meaningful history | SR | — | — | `git log --oneline` review |
| A1–A8 | ED | Resolved by D1–D8 | UI follows documented rules | Documented in this file + `data-model.md` |
