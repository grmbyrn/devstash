import { vi } from "vitest";

/**
 * Hand-rolled stand-in for the Prisma client, covering the models and methods the
 * actions and auth helpers actually call. Unit tests never touch a real database.
 *
 * ```ts
 * vi.mock("@/lib/prisma", async () => ({
 *   prisma: (await import("@/test/prisma-mock")).prismaMock,
 * }));
 * ```
 *
 * `restoreMocks` in `vitest.config.ts` resets call history between tests; add any
 * missing method here as new code needs it.
 */
export const prismaMock = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  verificationToken: {
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  item: {
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  collection: {
    count: vi.fn(),
  },
  // Actions pass an array of operations; resolving it is enough for unit tests.
  $transaction: vi.fn(async (operations: Promise<unknown>[]) =>
    Promise.all(operations),
  ),
};
