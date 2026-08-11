# Habit Shaper

Web app for building positive habits and breaking negative ones — daily
completion streaks, weekly completion rates, relapse resets, and goals linked
to habits.

## Architecture

Three containers orchestrated by `docker compose`:

- `frontend` — React + TypeScript + Vite SPA, served by nginx (proxies `/api` to the backend)
- `backend` — Node.js + TypeScript + Express REST API
- `db` — MySQL 8 (internal only; named volume `db_data` for persistence)

## Development status

Phase 1 — infrastructure foundation only. The skeleton boots and serves a
placeholder page. **No business features are implemented yet** (no auth,
habits, tracking, streaks, or goals).

## Quick start

```sh
docker compose up --build
```

- App: http://localhost:3000
- Backend health (direct): http://localhost:3001/api/health

The db container initializes itself on first boot.

## Environment

Optional: copy `.env.example` to `.env` to override the dev defaults (all
values are placeholders). See `.env.example` for the full contract.

## Reset (database)

```sh
docker compose down -v   # removes containers + the db volume
docker compose up -d     # fresh database
```

## Tests

Not yet — planned for later phases (Vitest + Supertest backend, smoke tests
frontend).
