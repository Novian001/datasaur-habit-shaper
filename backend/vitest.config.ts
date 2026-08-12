import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Supertest + real Express app; no server listen needed.
    include: ["test/**/*.test.ts"],
    // Global setup file sets env + Prisma client singleton for tests.
    setupFiles: ["test/vitest.setup.ts"],
    testTimeout: 20000,
    // Files share one test DB; run sequentially so each file's
    // beforeEach(user.deleteMany) cannot clobber another file's data mid-run.
    fileParallelism: false,
  },
});
