import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RATE_LIMITS,
  getClientIp,
  rateLimitMessage,
  retryAfterMinutes,
  retryAfterSeconds,
} from "@/lib/rate-limit";

const headersMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ headers: headersMock }));

/** Minimal stand-in for the read-only `Headers` the request exposes. */
function requestHeaders(values: Record<string, string>) {
  headersMock.mockResolvedValue(new Headers(values));
}

describe("RATE_LIMITS", () => {
  it("gives every limiter its own Redis prefix", () => {
    const prefixes = Object.values(RATE_LIMITS).map((config) => config.prefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });
});

describe("getClientIp", () => {
  it("takes the first entry of x-forwarded-for (the client)", async () => {
    requestHeaders({ "x-forwarded-for": "203.0.113.5, 70.41.3.18, 150.172.238.178" });
    await expect(getClientIp()).resolves.toBe("203.0.113.5");
  });

  it("trims whitespace around the address", async () => {
    requestHeaders({ "x-forwarded-for": "  203.0.113.5 , 70.41.3.18" });
    await expect(getClientIp()).resolves.toBe("203.0.113.5");
  });

  it("prefers x-forwarded-for over x-real-ip", async () => {
    requestHeaders({
      "x-forwarded-for": "203.0.113.5",
      "x-real-ip": "198.51.100.9",
    });
    await expect(getClientIp()).resolves.toBe("203.0.113.5");
  });

  it("falls back to x-real-ip", async () => {
    requestHeaders({ "x-real-ip": "198.51.100.9" });
    await expect(getClientIp()).resolves.toBe("198.51.100.9");
  });

  it("falls back to a constant when no proxy header is present", async () => {
    requestHeaders({});
    await expect(getClientIp()).resolves.toBe("127.0.0.1");
  });

  it("falls back when x-forwarded-for is empty rather than returning a blank key", async () => {
    requestHeaders({ "x-forwarded-for": " " });
    await expect(getClientIp()).resolves.toBe("127.0.0.1");
  });
});

describe("retry helpers", () => {
  const NOW = new Date("2026-07-31T12:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rounds partial minutes up", () => {
    expect(retryAfterMinutes(NOW + 61_000)).toBe(2);
    expect(retryAfterMinutes(NOW + 120_000)).toBe(2);
  });

  it("never reports less than a minute, even for an elapsed window", () => {
    expect(retryAfterMinutes(NOW + 1_000)).toBe(1);
    expect(retryAfterMinutes(NOW - 60_000)).toBe(1);
  });

  it("rounds seconds up and floors at zero for Retry-After", () => {
    expect(retryAfterSeconds(NOW + 1_500)).toBe(2);
    expect(retryAfterSeconds(NOW - 5_000)).toBe(0);
  });

  it("pluralizes the user-facing message", () => {
    expect(rateLimitMessage(NOW + 30_000)).toBe(
      "Too many attempts. Please try again in 1 minute.",
    );
    expect(rateLimitMessage(NOW + 15 * 60_000)).toBe(
      "Too many attempts. Please try again in 15 minutes.",
    );
  });
});

describe("checkRateLimit", () => {
  beforeEach(() => {
    // The Redis client and limiters are cached at module scope, so each of these
    // tests needs a fresh copy of the module to pick up different env/behaviour.
    vi.resetModules();
  });

  it("fails open when Upstash is not configured", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const { checkRateLimit } = await import("@/lib/rate-limit");

    await expect(checkRateLimit("login", "1.2.3.4:a@b.io")).resolves.toEqual({
      success: true,
      remaining: -1,
      reset: 0,
      limit: -1,
    });
  });

  it("fails open when the limiter throws, so a Redis outage can't lock users out", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    const limit = vi.fn().mockRejectedValue(new Error("redis down"));
    vi.doMock("@upstash/ratelimit", () => ({
      Ratelimit: Object.assign(
        class {
          limit = limit;
        },
        { slidingWindow: vi.fn() },
      ),
    }));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { checkRateLimit } = await import("@/lib/rate-limit");
    const result = await checkRateLimit("login", "1.2.3.4:a@b.io");

    expect(result.success).toBe(true);
    expect(limit).toHaveBeenCalledWith("1.2.3.4:a@b.io");
    expect(consoleError).toHaveBeenCalled();
  });

  it("passes the limiter verdict through when Upstash answers", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    const reset = Date.now() + 60_000;
    vi.doMock("@upstash/ratelimit", () => ({
      Ratelimit: Object.assign(
        class {
          limit = vi
            .fn()
            .mockResolvedValue({ success: false, remaining: 0, reset, limit: 5 });
        },
        { slidingWindow: vi.fn() },
      ),
    }));

    const { checkRateLimit } = await import("@/lib/rate-limit");

    await expect(checkRateLimit("login", "1.2.3.4:a@b.io")).resolves.toEqual({
      success: false,
      remaining: 0,
      reset,
      limit: 5,
    });
  });
});
