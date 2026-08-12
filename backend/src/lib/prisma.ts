import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

// Prisma 7 requires a driver adapter for runtime DB access, and the generated
// client lives at src/generated/prisma (custom output, Phase 2 design).
// DATABASE_URL is injected by compose at runtime; see prisma.config.ts.
const adapter = new PrismaMariaDb(process.env.DATABASE_URL ?? "");
export const prisma = new PrismaClient({ adapter });
