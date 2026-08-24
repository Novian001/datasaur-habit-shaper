# Habit Shaper — API Contract

> REST contract. All routes are JSON. All authenticated routes require
> `Authorization: Bearer <JWT>`. Validation via Zod. Error shape (consistent):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Zod validation failed (body/query/params) |
| 401 | `UNAUTHORIZED` | Missing/invalid/expired token |
| 404 | `NOT_FOUND` | Resource doesn't exist — or exists but belongs to another user (uniform hiding, D7) |
| 409 | `CONFLICT` | Duplicate email |

All dates are naive `YYYY-MM-DD` strings (D8). The **frontend** determines the
user's local calendar date and sends it explicitly for daily actions (as `date`
/ `relapseDate`), as the reference "today" (`refDate`), and as the habit start
date (`startDate`); the backend never uses a server clock for habit calendar
semantics. `startDate` (business calendar boundary) and `createdAt` (audit
timestamp) are distinct — createdAt is never converted to a calendar date.

---

## 1. Authentication

### POST /api/auth/register

Auth: none. Body:
```json
{ "email": "user@example.com", "password": "secret123" }
```
Validation: email format; password min 8 chars (Zod). Success 201:
```json
{
  "user": { "id": 1, "email": "user@example.com", "createdAt": "..." },
  "token": "<jwt>"
}
```
Errors: 400 invalid body; 409 `CONFLICT` duplicate email.

### POST /api/auth/login

Auth: none. Body: same as register. Success 200: same shape as register.
Errors: 400 invalid body; 401 `UNAUTHORIZED` wrong email or password (same
message for both — no user enumeration).

### GET /api/auth/me

Auth: required. Success 200:
```json
{ "user": { "id": 1, "email": "user@example.com", "createdAt": "..." } }
```
Errors: 401 missing/invalid token.

---

## 2. Habits

### GET /api/habits?refDate=YYYY-MM-DD

Auth: required. `refDate` query param: the reference calendar date for stats
(frontend local date; required — no server-clock fallback, D8). Success 200 —
current user's habits, each with computed stats:
```json
{
  "habits": [
    {
      "id": 1,
      "name": "Meditate",
      "type": "BUILD",
      "frequencyType": "DAILY",
      "weeklyTarget": null,
      "createdAt": "...",
      "stats": {
        "currentStreak": 4,
        "weekCompleted": 3,
        "weekElapsedDays": 4,
        "weekCompletionRate": 0.75,
        "missedDays": 1
      }
    },
    {
      "id": 2,
      "name": "Gym",
      "type": "BUILD",
      "frequencyType": "TIMES_PER_WEEK",
      "weeklyTarget": 3,
      "createdAt": "...",
      "stats": {
        "weeklyStreak": 4,
        "weeklyCompleted": 2,
        "weeklyTarget": 3,
        "weeklyRemaining": 1,
        "weeklyGoalReached": false,
        "weeklyCompletionRate": 0.667
      }
    }
  ]
}
```
BREAK habits return `{ "cleanStreak": 9, "lastRelapseDate": "..." | null }` instead.

### POST /api/habits

Auth: required. Body — DAILY (backward-compatible, no frequency field):
```json
{ "name": "Meditate", "type": "BUILD", "startDate": "2026-08-12" }
```
Or TIMES_PER_WEEK (BUILD habits only):
```json
{
  "name": "Gym",
  "type": "BUILD",
  "startDate": "2026-08-12",
  "frequency": { "type": "TIMES_PER_WEEK", "target": 3 }
}
```
Validation: name 1–120 chars; type `BUILD`|`BREAK`; `startDate` required;
`frequency.type` `DAILY`|`TIMES_PER_WEEK` (optional, defaults to `DAILY`);
`frequency.target` integer 1..7 (required when `frequency.type = TIMES_PER_WEEK`);
`TIMES_PER_WEEK` is rejected for `type = BREAK`. Success 201 — habit object
including `frequencyType` and `weeklyTarget` (null for DAILY). Errors: 400 invalid;
401.

### GET /api/habits/:id?refDate=YYYY-MM-DD

Auth: required; ownership scoped. `refDate` query param required (D8). Success 200:
```json
{
  "habit": {
    "id": 1,
    "name": "Meditate",
    "type": "BUILD",
    "frequencyType": "DAILY",
    "weeklyTarget": null,
    "createdAt": "..."
  },
  "stats": {
    "currentStreak": 4,
    "weekCompleted": 3,
    "weekElapsedDays": 4,
    "weekCompletionRate": 0.75,
    "missedDays": 1
  },
  "completedDates": ["2026-08-10", "2026-08-09", "2026-08-08"]
}
```
TIMES_PER_WEEK BUILD: `stats` returns `{ weeklyStreak, weeklyTarget, weeklyCompleted, weeklyRemaining, weeklyGoalReached, weeklyCompletionRate }` instead.
BREAK variant: `stats: { "cleanStreak": 9, "lastRelapseDate": "..." | null }`,
`relapseDates: ["2026-08-01"]`. Errors: 401; 404 not found / not owned.

---

## 3. Build Tracking

### PUT /api/habits/:id/completions

Auth: required. Body:
```json
{ "date": "2026-08-11", "refDate": "2026-08-12" }
```
Behavior (D2, D8):
- Habit must be type BUILD (else 400 `INVALID_HABIT_TYPE`).
- `date` must be `YYYY-MM-DD`, not after `refDate`, not before the habit's
  `startDate` (400 otherwise). `date` is the frontend's local calendar date;
  `refDate` is the frontend's local "today" — the backend never reads a server
  clock for the not-future rule (D8).
- **Idempotent:** marking an already-completed date succeeds without creating a
  duplicate row and without changing state. Consistent success status: **200 OK**
  (201 on first-time creation of the row). The UNIQUE(habit_id, date) constraint
  guarantees no duplicates; the app returns the existing row on repeat.
Success 200 (repeat) / 201 (first):
```json
{ "completion": { "id": 10, "habitId": 1, "date": "2026-08-11" } }
```
Errors: 400 invalid/type/future; 401; 404 not owned.

### DELETE /api/habits/:id/completions/:date

Auth: required. **ED (optional convenience):** removes a completion row (undo).
Success 204. Errors: 401; 404 not owned/not found.

---

## 4. Break Tracking

### POST /api/habits/:id/relapses

Auth: required. Body:
```json
{ "relapseDate": "2026-08-11", "refDate": "2026-08-12" }
```
Behavior (D5, D8):
- Habit must be type BREAK (else 400 `INVALID_HABIT_TYPE`).
- Date must be `YYYY-MM-DD`, not after `refDate`, not before the habit's
  `startDate` (400). `date` is the frontend's local calendar date; `refDate`
  is the frontend's local "today" — no server clock (D8).
- **Idempotent:** a relapse already recorded for the same date succeeds without
  creating a duplicate row and without changing state (200; 201 on first
  recording). UNIQUE(habit_id, relapse_date) guarantees no duplicates (D5).
Success 200 (repeat) / 201 (first):
```json
{ "relapse": { "id": 3, "habitId": 1, "relapseDate": "2026-08-11" } }
```
Errors: 400/401/404.

---

## 5. Goals

### GET /api/goals

Auth: required. Success 200:
```json
{
  "goals": [
    { "id": 1, "habitId": 3, "title": "Meditate daily", "description": null,
      "createdAt": "...", "updatedAt": "...",
      "habit": { "id": 3, "name": "Meditate", "type": "BUILD" } }
  ]
}
```
(`habit` embedded for the UI's habit picker display.)

### POST /api/goals

Auth: required. Body:
```json
{ "habitId": 3, "title": "Meditate daily", "description": "10 min every morning" }
```
Validation: habitId required (integer); title 1–200 chars; description ≤ 1000
chars optional. **Ownership (D7):** habitId must belong to the caller — if the
habit doesn't exist **or belongs to another user**, return **404 NOT_FOUND**
(uniform hiding; never 403). Success 201: goal object with embedded habit.

### PATCH /api/goals/:id

Auth: required. Body (any subset):
```json
{ "title": "Meditate 15 min", "description": null, "habitId": 3 }
```
Validation: as POST; `habitId` re-checks ownership (foreign → 404, D7). Success 200: updated goal.
Errors: 400; 401; 404.

### DELETE /api/goals/:id

Auth: required. Success 204. Errors: 401; 404 (not found / not owned).

---

## 6. Health

### GET /api/health

Auth: none. Success 200:
```json
{ "status": "ok", "db": "up" }
```
Used by compose healthcheck (readiness gate).

---

## 7. Authorization Summary (D7 — uniform 404 hiding)

| Route | Ownership rule |
|---|---|
| All `/habits*` | `WHERE id = :id AND user_id = :userId` — else 404 |
| `/habits/:id/completions`, `/relapses` | parent habit owned — else 404 |
| All `/goals*` | `WHERE id = :id AND user_id = :userId` — else 404 |
| Goal create/edit `habitId` | habit exists AND owned by caller — else **404** (no 403) |
| `/auth/me` | from token — 401 if invalid |

Design note: **one rule everywhere** — a resource that is not the caller's is
indistinguishable from one that does not exist (404). No 403 anywhere in the
API; no resource-existence leakage to other users (D7).
