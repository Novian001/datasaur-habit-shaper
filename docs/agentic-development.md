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

## Scope Note (this session)

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
