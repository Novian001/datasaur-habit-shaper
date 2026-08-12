# Habit Shaper — Data Model

> Relational design for MySQL 8 via Prisma. No migrations are created in this phase —
> this document is the specification the Prisma schema will implement.

---

## 1. Source of Truth Principle

**Streaks are derived, never stored.** The database stores facts (completions,
relapses, habit creation dates); streak/weekly numbers are computed by the stats
service from those facts. No `current_streak` column, no denormalized counters.

**Why:** a stored counter can drift from its inputs (a deleted completion, an
imported history, a timezone edge), and every fix requires a migration or a
recompute job. Deriving from event rows is O(n) over a habit's rows (tiny for this
app), is always consistent, and keeps a single source of truth.

**Tradeoff:** derivation costs a query per stats read. Accepted: habit histories
are small (≤ 365 rows/year); MySQL indexes make this trivial. Revisit only if
habit counts grow to thousands of rows per habit (out of scope).

---

## 2. Tables

### users

| Column | Type | Constraints |
|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT |
| email | VARCHAR(255) | **UNIQUE**, NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL |
| created_at | DATETIME(3) | NOT NULL, DEFAULT now |

- `UNIQUE(email)` enforces one account per email (R1).
- Password stored as bcrypt hash only — never plaintext.
- No name/profile columns — YAGNI, nothing in the brief needs them.

### habits

| Column | Type | Constraints |
|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT |
| user_id | INT UNSIGNED | NOT NULL, **FK → users.id, ON DELETE CASCADE** |
| name | VARCHAR(120) | NOT NULL |
| type | ENUM('BUILD','BREAK') | NOT NULL |
| start_date | DATE | NOT NULL |
| created_at | DATETIME(3) | NOT NULL, DEFAULT now |

- **`start_date`** is the business calendar boundary: the client's local
  calendar date when the habit began (D8). Distinct from `created_at` (audit
  timestamp) — `created_at` is never converted to a calendar date
  (human-review correction 2026-08-12).
- **Index:** `(user_id)` — every access path filters by owner first.
- Ownership enforced structurally (FK) and by query scoping (all reads/writes
  filter `user_id = req.userId`).
- `type` decides which child table applies (completions vs relapses) — see below.

### habit_completions (BUILD habits only)

| Column | Type | Constraints |
|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT |
| habit_id | INT UNSIGNED | NOT NULL, **FK → habits.id, ON DELETE CASCADE** |
| date | DATE | NOT NULL |
| created_at | DATETIME(3) | NOT NULL, DEFAULT now |

- **UNIQUE(habit_id, date)** — at most one completion per habit per calendar day (D2).
- **Index:** `(habit_id, date)` (the unique index doubles as the lookup index).
- `date` is a naive `DATE` (no time, no timezone) — D8.
- Completed-on row records *which day* was completed; `created_at` records *when*.

### relapse_events (BREAK habits only)

| Column | Type | Constraints |
|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT |
| habit_id | INT UNSIGNED | NOT NULL, **FK → habits.id, ON DELETE CASCADE** |
| relapse_date | DATE | NOT NULL |
| created_at | DATETIME(3) | NOT NULL, DEFAULT now |

- **UNIQUE(habit_id, relapse_date)** — one relapse per habit per day; a second
  relapse on the same date is rejected (D5).
- **Index:** `(habit_id, relapse_date)`.
- Same naive-DATE convention (D8).

### goals

| Column | Type | Constraints |
|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT |
| user_id | INT UNSIGNED | NOT NULL, **FK → users.id, ON DELETE CASCADE** |
| habit_id | INT UNSIGNED | NOT NULL, **FK → habits.id, ON DELETE CASCADE** |
| title | VARCHAR(200) | NOT NULL |
| description | VARCHAR(1000) | NULL |
| created_at | DATETIME(3) | NOT NULL, DEFAULT now |
| updated_at | DATETIME(3) | NOT NULL, DEFAULT now ON UPDATE now |

- **Index:** `(user_id)`.
- `habit_id NOT NULL` enforces "every goal linked to one habit" (R15).
- **ED (D6):** minimal model — no targets, deadlines, priority, or status.
  The brief lists only add/edit/remove + habit link; anything more is scope creep.
- Goal belongs to the *same* user as its habit: application-level check in the goal
  service (habit must have `user_id == goal.user_id`). No cross-user goals.

---

## 3. Relations Summary

```
users 1 ──── * habits
habits 1 ──── * habit_completions   (BUILD only, enforced in app logic)
habits 1 ──── * relapse_events      (BREAK only, enforced in app logic)
users 1 ──── * goals
habits 1 ──── * goals
```

- **CASCADE deletes:** deleting a user deletes their habits → completions,
  relapses, and goals (via habit FK) and direct goals. No orphans.
- **Type-vs-table enforcement** (completions only for BUILD, relapses only for
  BREAK) lives in the application service layer: a completion write to a BREAK
  habit returns 400. (A CHECK constraint could do this, but Prisma's DDL support
  for cross-table checks is awkward — app-layer enforcement is simpler and testable.)

---

## 4. Derivation Rules (what the stats service computes)

All dates naive `YYYY-MM-DD`; the **frontend supplies the reference "today" date**
explicitly for daily actions and stats; the backend never derives "today" from a
server/container clock (D8).

### Build habit — current streak (D1)

Reference date `refDate` comes from the client (default: frontend local date).

```
completedDays = SELECT date FROM habit_completions WHERE habit_id = ? ORDER BY date DESC
streak = 0
walk from refDate backward:
  if refDate completed          → count refDate, continue to previous day
  if refDate NOT completed      → skip refDate (in-progress day), start counting from the day before
  for each consecutive day d going backward:
      if d completed → streak++
      else           → break
```

- An **unfinished reference day never breaks the streak** (it just isn't counted yet).
- A missed past day breaks it.
- Streak counts consecutive *completed* calendar days, ending at refDate (if
  completed) or the day before refDate (if refDate is still in progress).

### Build habit — weekly completion (D3)

```
refDate       = client-supplied reference date (frontend local calendar date)
weekStartDate = Monday on or before refDate        (calendar DATE, no timestamps)
weekEndDate   = Sunday on or after refDate         (calendar DATE, no timestamps)
eligibleDays  = calendar days in [max(weekStartDate, habit.startDate), refDate]
                — future dates (after refDate) excluded; pre-start dates excluded
completedCount = completions in [max(weekStartDate, habit.startDate), refDate]
completionRate = completedCount / len(eligibleDays)   (0 if eligibleDays empty)
missedDays     = len(eligibleDays) - completedCount
```

- The week is a **range of calendar DATEs** (Monday–Sunday) — no timestamp
  boundaries, no UTC "week start instant" (D3).
- Future dates in the current week are **not** counted as missed (D3).
- Days before habit creation are **not** counted (D3).
- Weekly completion rate = completed ÷ eligible elapsed days (not ÷ 7) — the
  honest number, documented as ED (D3).

### Break habit — clean streak (D4, D5)

```
relapses = SELECT relapse_date FROM relapse_events WHERE habit_id = ? ORDER BY relapse_date ASC
creation = habit.startDate date  (client-supplied calendar boundary, D8)
refDate  = client-supplied reference date (frontend local calendar date)

if no relapses:
    cleanStreak = days between creation and refDate (inclusive of refDate)
else:
    lastRelapse = max(relapse_date)
    if lastRelapse == refDate:
        cleanStreak = 0
    else:
        cleanStreak = days between lastRelapse+1 and refDate (inclusive)
```

- Clean days are **inferred** — no daily "clean" button (D4).
- On a relapse day, streak = **0**; Day 1 restarts the **next** day (D5).
- `relapseEvents` returned in stats for the UI to show "Day 1, Day 2, Day 3…"
  progression (R10).

---

## 5. Unique Constraints & Indexes (final list)

| Constraint | Purpose |
|---|---|
| `UNIQUE(users.email)` | one account per email (R1) |
| `UNIQUE(habit_completions.habit_id, date)` | one completion per habit/day (D2, R4) |
| `UNIQUE(relapse_events.habit_id, relapse_date)` | one relapse per habit/day (D5) |
| `INDEX(habits.user_id)` | ownership lookups |
| `INDEX(goals.user_id)` | ownership lookups |
| `INDEX(goals.habit_id)` | FK + link lookups |

---

## 6. BUILD vs BREAK — Why Event-Based for BREAK (Decision D4 Analysis)

**Option A — daily CLEAN rows (mirror of BUILD):** user presses "clean" each day;
streak = count of consecutive clean rows.

- Pros: symmetric with BUILD, trivial streak math.
- Cons: **invents a requirement** (the brief never asks for a daily clean action);
  double entry (clean *and* relapse buttons per day); streak silently resets if the
  user forgets to press "clean" for a day they were actually fine — penalizing
  non-action; more UI clutter; more failure modes in tests.

**Option B — relapse-event storage, clean days inferred (CHOSEN, D4):**

- Pros: matches the brief's vocabulary exactly (only *relapse* is an explicit
  user-recorded event); a missed "clean" press is impossible because there is no
  such press; fewer UI controls; fewer tests; streak definition is unambiguous.
- Cons: cannot represent "I relapsed but am back on track within the same day"
  (irrelevant — the day is a relapse day regardless); a user who simply stops
  logging anything keeps a growing clean streak (accepted: the app records
  *events*, not *absence of events*; this matches habit-tracker convention where
  only the relapse is salient).

**Decision:** Option B. Tradeoff accepted and documented; flag for human review.

---

## 7. Open Decisions For Human Review

| Decision | Proposed | Alternative | Notes |
|---|---|---|---|
| D4 break model | relapse events + inferred clean days | daily clean rows | analyzed above; Option B |
| D8 dates | naive DATE + **client-supplied reference date** (no server clock) | server-UTC "today" / per-user timezone | documented; simplest correct choice |
| D6 goals | title + optional description | add target/deadline | rejected: scope creep |
| Completion duplicate | **idempotent PUT → 200** (no 409) | reject 409 | contract in api-contract.md |
