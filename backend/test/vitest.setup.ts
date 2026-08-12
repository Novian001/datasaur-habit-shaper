// Vitest global setup — runs once before the suite.
// The test service (compose.test.yml) injects DATABASE_URL pointing at the
// dedicated `habit_shaper_test` database and runs `prisma migrate deploy`
// before vitest starts, so lib/prisma.ts binds to the test DB at import.
// Per-test user cleanup lives in auth.test.ts (beforeEach).
import { prisma } from "../src/lib/prisma.js";

// Touch the client so connection errors surface at setup, not mid-test.
await prisma.$queryRaw`SELECT 1`;
