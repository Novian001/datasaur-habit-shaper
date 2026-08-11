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
