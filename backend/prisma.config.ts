import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7: datasource URLs live here, not in schema.prisma.
// DATABASE_URL is injected by compose (or dotenv from backend/.env if present).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "mysql://habit_user:habit_password@localhost:3306/habit_shaper",
  },
});
