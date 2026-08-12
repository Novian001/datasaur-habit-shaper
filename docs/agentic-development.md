# Agentic Development Log

> Transparent record of how this project was developed with coding-agent
> assistance. Documents observable decisions and engineering results — no hidden
> chain-of-thought, no raw chat dumps.

---

## Phase 0 — Planning (current)

- **Goal:** Pre-flight environment verification, local repo bootstrap, planning
  documentation, first (planning-only) commit, private GitHub repository.
- **Agent:** Hermes (Nous Research) acting as senior SWE / agentic development
  partner, operated by the human developer.
- **Prompt/Instruction Summary (human → agent):** Full brief for the Datasaur.ai
  3-day coding test (Habit Shaper), with explicit constraints: planning-first
  commit, no implementation in this session, containerized `docker compose up`
  deliverable, private GitHub repo, reviewer access rules, and a mandatory
  final-report format.
- **Actions:**
  1. Pre-flight: verified git 2.37.3, git identity, Docker 27.5.1 + Compose
     v2.32.4, Docker daemon, gh CLI 2.97.0 authenticated as **Novian001** (scopes:
     repo, workflow, gist, read:org), target directory absent (no conflict),
     remote repo absent (no conflict).
  2. Phase 1: created `D:\alif\Portofolio\datasaur-habit-shaper`, `git init -b main`.
  3. Phase 2: wrote the 7 planning documents (`docs/`).
  4. Human review: applied the approved business-rule decisions (D1–D8) and the
     repo-local Git identity to the planning documents (update only — no code).
- **Verification:** All pre-flight checks pass. No application code exists
  (only `docs/`). Working tree shows only untracked `docs/`.
- **Human Decision:** **APPROVED (with adjustments)** — the human provided the
  repo-local Git identity for this repository (name: `Muhammad Alif Rahmat
  Novian Arsianto`; email: pending — human will supply the GitHub noreply email
  from Settings → Emails; global identity and global config untouched). The
  human reviewed the 8 business-rule decisions and approved them with
  adjustments, all now reflected in the planning docs:
  - D1 approved as written (streak survives an unfinished current day).
  - D2 modified: completion marking **idempotent** — repeat PUT returns 200,
    no duplicate row, no state change (no 409).
  - D3 approved with wording change: week = Monday→Sunday **calendar DATE
    range** (no timestamp boundaries); denominator = eligible elapsed days.
  - D4 approved (relapse-event storage, clean days inferred, no daily clean).
  - D5 approved (relapse day → streak 0; Day 1 next day).
  - D6 approved (minimal goal: title, optional description, linked habit).
  - D7 modified: **uniform 404 hiding** — foreign resources (habits, goals,
    tracking, goal habit_id) return 404, never 403.
  - D8 modified: **no server/container UTC clock** — frontend supplies the
    local calendar date explicitly (daily actions + stats refDate); backend
    validates/stores naive DATE only.
  - Completion-duplicate question resolved: idempotent (200), not 409.
- **Open Questions:**
  1. Repo-local Git email — the human will provide the GitHub noreply email
     from Settings → Emails before the first commit. Commit blocked until then.
  2. Reviewer invite timing — explicitly deferred until final verification +
     human approval (R26).

---

## Phase 1 — Infrastructure / Application Foundation

- **Goal:** Create the containerized React + Express + MySQL skeleton: compose
  topology, env contract, ignore files, minimal frontend placeholder, backend
  health endpoint, Dockerfiles, lockfiles, and a clean boot verification.
- **Agent:** Hermes (Nous Research) — same agentic-development partner.
- **Prompt/Instruction Summary (human → agent):** "Planning has been reviewed
  and approved for implementation to begin. You may now begin IMPLEMENTATION
  PHASE 1 ONLY." Full Phase 1 scope: repository/application scaffolding,
  frontend React+TS+Vite skeleton, backend Node+TS+Express skeleton, MySQL
  service definition, Dockerfiles, root `compose.yml`, basic health endpoint,
  minimal frontend placeholder, environment variable contract, ignore files,
  build/start scripts, Docker networking/readiness, and documentation of
  observable agentic work. Explicitly NO business functionality (no
  auth/habits/goals/streaks/prisma/migrations/business tables).
- **Actions:**
  1. Read all 7 committed planning docs (source of truth) and verified git
     state (main @ 2544b91, clean, origin synced).
  2. Verified no host ports 3000/3001 in use and no containers running.
  3. Wrote root files: `compose.yml` (db/backend/frontend, healthchecks,
     named volume `db_data`, port 3000), `.env.example` (MySQL/JWT/port
     placeholders), `.gitignore`, minimal `README.md`.
  4. Backend scaffold: `package.json` (Express 5, TS), `tsconfig.json`
     (strict), `src/app.ts` + `src/server.ts` + `src/routes/health.ts`
     (`GET /api/health`), `Dockerfile` (multi-stage deps→build→run), lockfile.
  5. Frontend scaffold: Vite + React 18 + TS, `src/main.tsx`, `src/App.tsx`
     (placeholder + API health indicator), `src/index.css`, `index.html`,
     `vite.config.ts` (dev proxy /api→backend), `Dockerfile` (node build →
     nginx), `nginx.conf` (SPA + /api proxy), lockfile.
  6. Generated lockfiles with host npm (v20 — engine-compatible with the
     node:20 images; lockfile-v3 pins exact versions).
- **Verification:**
  - `docker compose config` — succeeds.
  - `docker compose up --build -d` — all 3 services start.
  - `docker compose ps` — db healthy, backend healthy, frontend up.
  - `curl http://localhost:3000/api/health` → `{"status":"ok"}` (through the
    nginx proxy, same-origin path).
  - `curl http://localhost:3001/api/health` → same, direct backend.
  - `curl http://localhost:3000/` → React app shell; the page fetches
    `/api/health` and displays "API status: Healthy".
  - `npm run build` (frontend) and `npm run typecheck` (backend) inside their
    containers — both pass.
  - MySQL container healthy; no business tables created (none expected).
- **Human Decision:** Approved to start implementation after the planning root
  commit ("Planning has been reviewed and approved for implementation to
  begin").
- **Deviations / Notes:**
  - Health response is `{ "status": "ok" }` — architecture.md §8 specifies
    `{ "status": "ok", "db": "up" }` once the DB layer exists; the `db` field
    arrives with Prisma in Phase 2. Compose healthcheck only requires HTTP 200.
  - No `entrypoint.sh` yet — the `prisma migrate deploy` step it will run
    belongs to Phase 2; the backend Dockerfile runs `node dist/server.js`
    directly for now.
  - No `backend/prisma/` yet — Phase 2 creates the schema + committed
    migrations.

---

This initial session was deliberately limited to:

- prerequisite verification
- architecture planning
- data-model planning
- API planning
- test strategy
- task planning

and intentionally did **NOT** implement source code — no React scaffold, no
Node scaffold, no Prisma schema, no migrations, no Dockerfiles, no compose.yml,
no package.json. The planning-first rule (R27) is preserved: the planning
commit must exist before any application code.

---

## Phase 2 — Database Model and Migration

- **Goal:** Implement the approved relational model (docs/data-model.md §2–3) and
  automatic schema bootstrap via committed Prisma migrations.
- **Agent:** Hermes (Nous Research) — same agentic-development partner.
- **Prompt/Instruction Summary (human → agent):** "Proceed with IMPLEMENTATION
  PHASE 2 ONLY: DATABASE MODEL + PRISMA + INITIAL MIGRATION." Scope: Prisma
  installation/configuration, schema, enums/models/relations, constraints,
  initial migration, automatic `migrate deploy` on container start, DB
  readiness verification, DB-focused checks. Explicitly NO auth/JWT/hashing/
  habit/goal/tracking routes, no streak/stat logic, no frontend business UI.
- **Actions:**
  1. Verified repo state (main @ 7141340, clean, origin synced) and re-read all
     7 planning docs — data-model.md matched the prompt shorthand; no conflicts.
  2. Added Prisma 7.9.1 (`prisma` devDep, `@prisma/client` + `dotenv` deps),
     regenerated `package-lock.json`.
  3. Wrote `backend/prisma/schema.prisma` — models User, Habit, HabitCompletion,
     RelapseEvent, Goal; enum HabitType (BUILD/BREAK); snake_case `@map`;
     `@db.Date` on completion/relapse dates (D8); `@db.UnsignedInt` PKs/FKs;
     UNIQUE(email), UNIQUE(habit_id,date), UNIQUE(habit_id,relapse_date);
     FK ON DELETE CASCADE; index (user_id) on habits/goals.
  4. Prisma 7 moved datasource URL out of schema → wrote `backend/prisma.config.ts`
     (DATABASE_URL from env); removed the schema `url` line.
  5. `prisma validate` → valid; `prisma generate` → client to
     `src/generated/prisma` (gitignored); added `src/generated/` to
     `backend/.gitignore`; tsconfig excludes it (build-time only).
  6. Generated initial migration via containerized `prisma migrate diff
     --from-empty --to-schema` → `backend/prisma/migrations/
     20260812002034_init_habit_schema/migration.sql` (+ `migration_lock.toml`).
     Reviewed the SQL: 5 tables, all constraints exactly per data-model.md;
     no manual edits.
  7. Dockerfile: copy `prisma/` + `prisma.config.ts` before `npm ci` (Prisma 7
     auto-generates client at install), run `entrypoint.sh`. New
     `backend/entrypoint.sh`: `npx prisma migrate deploy` → `node dist/server.js`.
  8. Health endpoint: kept `{ status: "ok" }` (see deviation below).
  9. Rebuilt backend image, recreated container. Entrypoint logs show
     "All migrations have been successfully applied" → "listening on :3000".
- **Verification (actual):**
  - `prisma validate` → "The schema at prisma/schema.prisma is valid".
  - `prisma generate` → client generated.
  - `prisma migrate deploy` (entrypoint, container start) → applied
    `20260812002034_init_habit_schema`, "All migrations have been successfully
    applied".
  - `SHOW CREATE TABLE` on MySQL: users (email UNIQUE, password_hash),
    habits (type ENUM('BUILD','BREAK'), user_id FK CASCADE, idx user_id),
    habit_completions (`date DATE`, UNIQUE(habit_id,date), FK CASCADE),
    relapse_events (`relapse_date DATE`, UNIQUE(habit_id,relapse_date)),
    goals (title, nullable description, FKs CASCADE) — all per data-model.md.
  - Ad-hoc probe script (Temp, `hermes-verify-phase2.sh`, since removed):
    19/19 checks — 6 tables present, DATE column types, all UNIQUE/index/FK
    constraints, integrity probes (duplicate email / completion / relapse
    rejected, invalid FK rejected), probe data cleaned up.
  - Backend image build (`npm run build` = tsc) succeeds.
- **Human Decision:** Phase 1 reviewed and Phase 2 approved ("Phase 1 has
  passed human review. Proceed with IMPLEMENTATION PHASE 2 ONLY").
- **Deviations / Notes:**
  - Health stays `{ status: "ok" }` — architecture.md §8's `db: "up"` field
    requires a Prisma runtime DB check, and Prisma 7's client needs a driver
    adapter (`@prisma/adapter-mysql`) for runtime use. Adding that dependency
    was declined; the `db` field is deferred to the phase that first uses
    Prisma at runtime (Phase 3+). Compose healthcheck only requires HTTP 200.
  - Migration directory named `20260812002034_init_habit_schema` (Prisma's
    timestamp convention) rather than task-breakdown.md's placeholder
    `0001_init` — naming only, same content.
  - Runtime image installs full deps (`npm ci`, not `--omit=dev`) so
    `npx prisma migrate deploy` works in the entrypoint (prisma is a devDep).
    This honors R20 (automatic bootstrap) at the cost of a slightly larger
    image — acceptable for a local test app.
  - Prisma 7 config lives in `backend/prisma.config.ts` (new file) — the
    datasource URL moved out of schema.prisma in v7.

---

## Phase 3 — Authentication (email + password)

- **Goal:** Implement the authentication boundary required by the coding test:
  register/login with email+password, bcrypt hashing, JWT, authenticated
  current-user endpoint, auth middleware, request validation, consistent
  auth errors, automated auth tests, Docker verification. No business
  features (habits, completions, relapses, streaks, stats, goals, UI).
- **Actions:**
  - Validation (`lib/validation.ts`): Zod schemas — email format + lowercase
    normalization, password min 8 / max 128 chars (api-contract.md).
  - Password hashing (`services/password.ts`): bcryptjs, cost 10.
  - JWT (`lib/jwt.ts`): `{ sub: userId, email }`, expiry 7d, secret from
    `JWT_SECRET` env — required at runtime, fail-fast (no built-in default).
  - Auth middleware (`middleware/auth.ts`): Bearer scheme → verify → attach
    `req.userId`; missing/invalid/expired → 401.
  - Routes (`routes/auth.ts`): `POST /api/auth/register` (201 + token),
    `POST /api/auth/login` (200 + token), `GET /api/auth/me` (Bearer).
    Duplicate email → 409; bad credentials → 401 generic (no enumeration).
  - Error handler (`middleware/errorHandler.ts`): uniform
    `{ error: { code, message } }`; never leaks stack/Prisma/SQL.
  - `app.ts` mounts auth under `/api/auth` (nginx exposes `/api`); `server.ts`
    fails fast if `JWT_SECRET` missing. Health endpoint now reports
    `{ status: "ok", db: "up" }` via Prisma `SELECT 1`.
  - Tests (`test/auth.test.ts`): Vitest + Supertest against the real app +
    dedicated `habit_shaper_test` DB (compose test service, `compose.test.yml`).
  - Env contract: `.env.example` `JWT_SECRET=dev-insecure-jwt-secret-change-me`
    (placeholder); compose passes `JWT_SECRET` to backend.
  - Prisma 7 build/config fixes: generated client requires explicit output
    (kept `src/generated/prisma`), driver adapter is `@prisma/adapter-mariadb`
    (Prisma 7 renamed the MySQL adapter), backend runs as ESM
    (`"type": "module"` — generated client uses `import.meta`), Dockerfile
    runs `npx prisma generate` and copies `src/generated` to the runtime stage.
- **Verification (actual):**
  - `docker compose config` (both files) → OK.
  - Backend image build (`npm run build` = tsc) → succeeds.
  - `docker compose ps` → db healthy, backend healthy, frontend running.
  - `GET :3000/api/health` → `{"status":"ok","db":"up"}` (was `{status:"ok"}`
    in Phase 2 — the deferred `db` check is now live).
  - Smoke tests via nginx proxy (:3000): register → 201 (user + token);
    duplicate register → 409 `CONFLICT`; login → 200 (token); `/auth/me`
    with Bearer → 200 correct user; `/auth/me` without token → 401; wrong
    password → 401 `Invalid email or password`; unknown email → 401 identical
    message (no enumeration).
  - DB evidence: `users` row for smoke account — email lowercase,
    `password_hash` bcrypt `$2a$10$` prefix, len 60, `password_hash !=
    submitted password` (is_plaintext=0), no plaintext password column.
    Smoke account deleted after verification (0 rows remain).
  - Automated tests: `docker compose -f compose.yml -f compose.test.yml run
    --rm backend-test` → **15/15 passed** (register 201; invalid email 400;
    short password 400; duplicate 409; hash stored not plaintext; login 200;
    wrong password 401; unknown email 401 same message; no passwordHash in
    responses; no token 401; malformed token 401; expired token 401;
    invalid-signature token 401; `/auth/me` 200 correct user; email
    lowercase-normalized).
  - Regression: frontend :3000 → 200 (SPA title "Habit Shaper"), health 200,
    migration `20260812002034_init_habit_schema` applied, 6 tables intact.
- **Human Decision:** Phase 2 reviewed; authentication phase approved
  ("Phase 2 has passed human review. Proceed with IMPLEMENTATION PHASE 3
  ONLY").
- **Deviations / Notes:**
  - `@prisma/adapter-mysql` does not exist on npm in Prisma 7 — the MySQL
    driver adapter is `@prisma/adapter-mariadb` (supports MySQL).
  - Prisma 7's `prisma-client` generator requires an explicit `output` path
    (kept Phase 2's `src/generated/prisma`); the generated client is ESM
    (`import.meta.url`), so the backend now runs as ESM (`"type": "module"`).
  - The Phase 2 deferred restart/migrate-deploy idempotence check could not
    be executed this phase either (container restart mutation still denied);
    it remains deferred to final clean-room verification (testing-strategy §6).
  - The previously-deferred `db: "up"` health field is now implemented
    (resolves the Phase 2 deviation).
