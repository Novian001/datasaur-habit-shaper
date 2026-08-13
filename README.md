# Habit Shaper

Web app for building positive habits and breaking negative ones — daily
completion streaks, weekly completion rates, relapse resets, and goals linked
to habits. Full-stack TypeScript, dockerized.

## Features

- **Auth** — email + password registration/login, JWT bearer, protected routes
- **Habits** — create BUILD (build a habit) and BREAK (quit a habit) habits
- **Tracking** — daily completion/undo (BUILD), relapse (BREAK), browser-local
  calendar dates (no server-clock dependence)
- **Stats** — current streak, weekly completed/missed/rate, clean streak, last
  relapse; all computed against an explicit `refDate`
- **Goals** — create/edit/delete goals, each linked to one owned habit
  (BUILD or BREAK), with embedded habit info
- **Ownership isolation** — every resource is user-scoped; foreign access
  returns uniform 404 (no enumeration, no 403)

## Architecture

Three containers orchestrated by `docker compose`:

- `frontend` — React + TypeScript + Vite SPA, served by nginx (proxies `/api` to the backend)
- `backend` — Node.js + TypeScript + Express REST API
- `db` — MySQL 8 (internal only; named volume `db_data` for persistence)

## Development status

All phases complete (see `docs/agentic-development.md` for the full phase
log): planning → scaffold → db model → auth → habits → tracking → stats →
goals backend → frontend auth → dashboard/tracking → goals UI → test suite →
clean-room Docker verification. Feature freeze active — no additional product
features planned.

## Quick start

```sh
docker compose up --build
```

- App: http://localhost:3000
- Backend health (direct): http://localhost:3001/api/health

The db container initializes itself on first boot (Prisma migrate deploy runs
on backend start).

## Environment

Optional: copy `.env.example` to `.env` to override the dev defaults (all
values are placeholders). See `.env.example` for the full contract.

## Reset (database)

```sh
docker compose down -v   # removes containers + the db volume
docker compose up -d     # fresh database
```

## Tests

- **Backend** (Vitest + Supertest, real Express + test MySQL):
  `docker compose -f compose.yml -f compose.test.yml run --rm backend-test`
  → 118/118 PASS
- **Frontend** (Vitest + jsdom + Testing Library): `cd frontend && npm test`
  → 47/47 PASS; `npx tsc --noEmit` clean; `npm run build` OK
- **E2E smoke** (through nginx :3000): `bash hermes-verify-phase9-e2e.sh`
  → 26/26

See `docs/testing-strategy.md` for the full matrix.
