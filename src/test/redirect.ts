/**
 * Test helpers for code that navigates with `redirect()` from `next/navigation`.
 *
 * The real `redirect` throws a `NEXT_REDIRECT` error to unwind the request, so a
 * server action's "return value" is really the URL it redirected to. Tests mock
 * the module with {@link redirectMock} and assert on that URL.
 */

export class RedirectError extends Error {
  constructor(readonly url: string) {
    super(`NEXT_REDIRECT: ${url}`);
    this.name = "RedirectError";
  }
}

/**
 * Stand-in for `next/navigation`'s `redirect`. Mirrors the real one by throwing,
 * so control flow after a redirect stops exactly as it does in production.
 *
 * ```ts
 * vi.mock("next/navigation", async () => ({
 *   redirect: (await import("@/test/redirect")).redirectMock,
 * }));
 * ```
 */
export function redirectMock(url: string): never {
  throw new RedirectError(url);
}

/**
 * Run `fn` and return the URL it redirected to. Fails if it finished without
 * redirecting, and rethrows any other error so real failures stay visible.
 */
export async function captureRedirect(
  fn: () => Promise<unknown>,
): Promise<string> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof RedirectError) return error.url;
    throw error;
  }
  throw new Error("Expected a redirect, but none was thrown");
}
