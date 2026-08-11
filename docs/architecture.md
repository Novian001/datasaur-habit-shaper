# Habit Shaper — Architecture

## 1. System Overview

Single-page React app talking to a REST API over HTTP. One MySQL database.
Three containers, orchestrated by a root-level `compose.yml`.

```
Browser
   │  HTTP :3000
   ▼
┌──────────────────────┐
│  frontend (React)    │  nginx (static SPA) — serves built assets, proxies /api → backend
└──────────┬───────────┘
           │  HTTP /api/*  (proxied)
           ▼
┌──────────────────────┐
│  backend (Node/TS)   │  Express REST API — auth, habits, tracking, goals, stats
└──────────┬───────────┘
           │  Prisma ORM
           ▼
┌──────────────────────┐
│  mysql:8 (MySQL)     │  single database, schema via Prisma migrations
└──────────────────────┘
```

All three services run on the **same Docker network** created by compose.
The only externally published port is **3000** (frontend). The backend and
database are internal to the network (backend still published to 3001 for
optional direct API access during development — see Ports).

---

## 2. Component Responsibilities

### Frontend (React + TypeScript + Vite)

- **Responsibility:** render the UI, manage auth session (JWT in `localStorage`), call the REST API.
- Pages (single route each, client-side only):
  - `/login`, `/register`
  - `/` dashboard (today's habits + quick actions)
  - `/habits` (list + create) → `/habits/:id` (detail: streak, weekly stats, history, relapse button)
  - `/goals` (list + create/edit/delete)
- Auth guard: a tiny wrapper component redirects unauthenticated users to `/login`.
- API client: thin `fetch` wrapper — attaches `Authorization: Bearer <token>`, parses JSON, surfaces `{ error }` messages.
- No state-management library (no Redux). Local component state + a small auth context only.
  - **ED:** YAGNI — the app has no cross-cutting shared state beyond the auth token. Revisit if complexity grows.

### Backend (Node.js + TypeScript + Express)

- **Responsibility:** the only authority on business rules — auth, ownership, streaks, weekly stats, relapse math.
- Layered but flat: `routes/` (HTTP) → `services/` (business logic) → `prisma` (data). No over-abstraction.
- Middleware: `auth` (JWT verify), `errorHandler` (central JSON error shape), Zod validation per route.
- Stateless (JWT); horizontally scalable trivially, though a single instance is the target.

### Database (MySQL 8)

- **Responsibility:** persistent storage + integrity. Enforces:
  - `UNIQUE(email)` on users
  - `UNIQUE(habit_id, date)` on build completions
  - `UNIQUE(habit_id, relapse_date)` on relapse events
  - `FK(habit.user_id → users.id)`, `FK(goal.user_id → users.id)`, `FK(goal.habit_id → habits.id)`
  - `ON DELETE CASCADE` for owned children (deleting a user removes their habits/completions/relapses/goals)
- Schema owned by **Prisma migrations**; bootstrap via `prisma migrate deploy` on backend container start.

---

## 3. Authentication Flow

1. **Register:** `POST /api/auth/register` → validate (Zod) → bcrypt-hash password → insert user → return `{ user, token }`.
2. **Login:** `POST /api/auth/login` → verify bcrypt → return `{ user, token }`.
3. **Every authenticated request:** `Authorization: Bearer <JWT>`.
   - JWT payload: `{ sub: userId, email }`, signed with `JWT_SECRET` (env), expiry `7d`.
   - `auth` middleware verifies signature + expiry, attaches `req.userId`.
4. **No email verification** (R1/R2 explicitly exclude it).
5. Frontend stores token in `localStorage`; logout = remove token + redirect.
   - **ED:** localStorage over httpOnly cookies because the app is a same-origin SPA proxied through nginx; simpler, no CSRF surface of consequence (bearer-in-header), and the test brief allows JWT. Tradeoff documented in Security §8.

---

## 4. Authorization / Ownership

- Every habit/goal query carries `WHERE userId = req.userId`.
- Resource routes resolve the resource by `id` + `userId` in one query — a resource that does not belong to the caller is indistinguishable from one that does not exist (**404**). Uniform hiding, never 403 (D7).
- Goal `habit_id` must reference a habit owned by the caller — validated in the goal service (404 if the habit doesn't exist OR belongs to another user).
- Relapse/completion writes re-check ownership of the parent habit (404).

## 4b. Dates / Timezones (D8)

- All habit calendar values are naive `DATE` / `YYYY-MM-DD` — no timestamps, no timezones.
- The **frontend** determines the user's local calendar date and sends it explicitly: as the `date` on completion/relapse actions and as the `refDate` query param on stats endpoints.
- The **backend** validates `YYYY-MM-DD`, stores naive DATE, and never converts habit dates through UTC timestamps. The backend never reads the clock for habit semantics.
- No timezone libraries, no per-user timezone profiles. Revisit only if a real need emerges.

---

## 5. Docker Compose Topology

`compose.yml` (root) defines, in order of startup dependency:

| Service | Image/build | Depends on | Ports | Healthcheck |
|---|---|---|---|---|
| `db` | `mysql:8.0` | — | none published | `mysqladmin ping` |
| `backend` | build `./backend` (multi-stage: deps → build → run) | `db` healthy | `3001:3000` (optional direct) | HTTP GET `/api/health` |
| `frontend` | build `./frontend` (multi-stage: build → nginx) | `backend` healthy | `3000:80` | nginx |

- **Networks:** one default bridge network; services reach each other by service name.
- **Named volume:** `db_data` for MySQL persistence. `docker compose down -v` destroys it → next `up` re-bootstraps (documented reset path, R24).
- **Env:** backend reads `DATABASE_URL`, `JWT_SECRET`, `PORT` from its environment; compose injects from repo-root `.env` (gitignored) or defaults. `.env.example` documents every variable.

---

## 6. Application Startup Sequence

```
docker compose up
  1. db starts; healthcheck waits for mysqladmin ping OK
  2. backend starts when db is healthy
       a. prisma migrate deploy   → applies migrations (idempotent; no-op when schema current)
       b. node dist/server.js     → Express listens on :3000 (container)
  3. frontend starts when backend healthy
       a. nginx serves built SPA on :80 → published to host :3000
       b. nginx /api → http://backend:3000 (reverse proxy, same-origin for the browser)
```

- **Schema bootstrap is automatic** (R20) — no manual migration step.
- First boot on a fresh volume: migrate deploy creates the schema. Subsequent boots: no-op.
- Backend container entrypoint script:
  ```sh
  npx prisma migrate deploy
  node dist/server.js
  ```

---

## 7. Service Dependencies & Intended Ports

| Service | Internal port | Host port | Purpose |
|---|---|---|---|
| frontend (nginx) | 80 | **3000** | App URL for the reviewer: http://localhost:3000 |
| backend (Express) | 3000 | 3001 | Optional direct API access (health, curl debugging) |
| db (MySQL) | 3306 | — | Never published; only reachable inside the network |

`frontend` depends on `backend` healthy; `backend` depends on `db` healthy.

---

## 8. Health / Readiness

- `GET /api/health` on backend → `200 { status: "ok", db: "up" }` after a cheap `SELECT 1` through Prisma.
- Compose healthchecks gate the startup order (`depends_on: condition: service_healthy`).
- Frontend nginx healthcheck: HTTP 200 on `/` (static file exists) or TCP check.

---

## 9. Error Handling Strategy

Central `errorHandler` middleware produces a consistent JSON shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…" } }
```

| HTTP | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Zod body/query/param validation failed |
| 401 | `UNAUTHORIZED` | Missing/invalid/expired token |
| 404 | `NOT_FOUND` | Resource does not exist — or exists but belongs to another user (uniform hiding, D7) |
| 409 | `CONFLICT` | Duplicate email |
| 500 | `INTERNAL_ERROR` | Unexpected; logged server-side with stack |

(403 is intentionally unused — ownership violations are uniformly 404, D7.)

Async route handlers wrapped so rejections reach the error handler (Express 5 handles rejected promises natively).

---

## 10. Security Basics (planned)

- Passwords: **bcrypt** (cost 10) — never stored in plaintext.
- JWT: signed with strong random `JWT_SECRET` from env; **no default secret in code** (compose fails fast if unset? — no: `.env.example` ships a dev placeholder; prod guidance in README).
- Secrets: `.env` gitignored; only `.env.example` committed.
- Input validation at every trust boundary (Zod on all request bodies/params/queries).
- SQL injection: Prisma parameterizes everything.
- CORS: not needed in production topology (same-origin via nginx proxy); enabled restrictively only in dev if needed.
- Rate limiting: skipped (local test app, no public deployment). **ED:** revisit only if deployed publicly.
- Helmet: optional hardening via `helmet` middleware — cheap, include it. **ED:** include; one dependency, real benefit.

---

## 11. Expected Final Repository Structure

```
datasaur-habit-shaper/
├── frontend/                  # React + TS + Vite SPA
│   ├── src/
│   │   ├── api/               # fetch client + endpoints
│   │   ├── components/
│   │   ├── pages/             # Login, Register, Dashboard, Habits, HabitDetail, Goals
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── Dockerfile             # multi-stage: node build → nginx serve
│   ├── nginx.conf             # SPA + /api proxy
│   ├── package.json
│   └── vite.config.ts
├── backend/                   # Node + TS + Express
│   ├── src/
│   │   ├── routes/            # auth, habits, goals
│   │   ├── services/          # stats/streak logic (pure functions)
│   │   ├── middleware/        # auth, errorHandler
│   │   ├── lib/               # prisma client, jwt, validation schemas
│   │   └── server.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/        # committed
│   ├── Dockerfile             # multi-stage: deps → build → run
│   ├── entrypoint.sh          # migrate deploy + start
│   ├── package.json
│   └── tsconfig.json
├── docs/                      # this planning set
│   ├── requirements-analysis.md
│   ├── architecture.md
│   ├── data-model.md
│   ├── api-contract.md
│   ├── task-breakdown.md
│   ├── testing-strategy.md
│   └── agentic-development.md
├── compose.yml
├── .env.example
├── .gitignore
└── README.md
```

Implementation directories (`frontend/`, `backend/`, `compose.yml`, etc.) are
created in later phases **after** this planning set is committed and reviewed.
