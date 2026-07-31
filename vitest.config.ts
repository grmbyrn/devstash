import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Unit tests only — server actions (`src/actions`) and utilities (`src/lib`).
 * Components are deliberately out of scope, so there's no jsdom/React setup here;
 * everything runs in a plain Node environment.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    // Tests that exercise real password hashing pay for bcrypt's 12 rounds, which
    // is slow enough to blow the 5s default once coverage instrumentation is on.
    testTimeout: 20_000,
    // `clearMocks` wipes call history between tests (`restoreMocks` alone only
    // restores `vi.spyOn` spies, so shared `vi.fn()` mocks would leak calls).
    // Env stubs aren't auto-restored: files that stub env call
    // `vi.unstubAllEnvs()` in their own `afterEach`.
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/actions/**/*.ts", "src/lib/**/*.ts"],
      exclude: ["src/lib/mock-data.ts", "src/lib/prisma.ts"],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
