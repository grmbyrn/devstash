import { headers } from "next/headers";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiting for the auth surface (brute force / credential stuffing / email
 * abuse). Built on Upstash Redis + `@upstash/ratelimit` sliding windows so it
 * works on serverless.
 *
 * Design notes:
 * - **Fails open.** If Upstash isn't configured or a check throws, requests are
 *   allowed. Rate limiting is a safety net, not an availability dependency — a
 *   Redis outage must never lock legitimate users out of signing in.
 * - Limiters are keyed by IP (and email where a tighter limit is wanted). The
 *   caller builds the identifier via {@link getClientIp}.
 */

// ─── Limit configs (mirrors the spec table) ─────────────────────────────────

type Duration = Parameters<typeof Ratelimit.slidingWindow>[1];

interface RateLimitConfig {
  /** Max attempts allowed within the window. */
  limit: number;
  /** Sliding window duration, e.g. "15 m" or "1 h". */
  window: Duration;
  /** Redis key prefix so the different limiters never share buckets. */
  prefix: string;
}

export const RATE_LIMITS = {
  login: { limit: 5, window: "15 m", prefix: "login" },
  register: { limit: 3, window: "1 h", prefix: "register" },
  forgotPassword: { limit: 3, window: "1 h", prefix: "forgot-password" },
  resetPassword: { limit: 5, window: "15 m", prefix: "reset-password" },
  resendVerification: {
    limit: 3,
    window: "15 m",
    prefix: "resend-verification",
  },
} as const satisfies Record<string, RateLimitConfig>;

export type RateLimitName = keyof typeof RATE_LIMITS;

// ─── Lazy Upstash client + limiter cache ─────────────────────────────────────

// `undefined` = not yet resolved, `null` = resolved-but-unconfigured.
let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  redisClient = url && token ? new Redis({ url, token }) : null;
  return redisClient;
}

const limiterCache = new Map<RateLimitName, Ratelimit>();

function getLimiter(name: RateLimitName): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  const cached = limiterCache.get(name);
  if (cached) return cached;

  const config = RATE_LIMITS[name];
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.limit, config.window),
    prefix: `ratelimit:${config.prefix}`,
    analytics: false,
  });
  limiterCache.set(name, limiter);
  return limiter;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface RateLimitResult {
  /** True if the request is allowed (also true when failing open). */
  success: boolean;
  /** Remaining attempts in the window, or -1 when rate limiting is inactive. */
  remaining: number;
  /** Epoch ms when the window resets, or 0 when rate limiting is inactive. */
  reset: number;
  /** The configured limit, or -1 when rate limiting is inactive. */
  limit: number;
}

const ALLOW_UNLIMITED: RateLimitResult = {
  success: true,
  remaining: -1,
  reset: 0,
  limit: -1,
};

/**
 * Consume one token for `identifier` against the named limiter. Fails open —
 * returns `success: true` when Upstash is unconfigured or the check errors.
 */
export async function checkRateLimit(
  name: RateLimitName,
  identifier: string,
): Promise<RateLimitResult> {
  const limiter = getLimiter(name);
  if (!limiter) return ALLOW_UNLIMITED;

  try {
    const { success, remaining, reset, limit } =
      await limiter.limit(identifier);
    return { success, remaining, reset, limit };
  } catch (error) {
    console.error(`Rate limit check "${name}" failed, allowing request:`, error);
    return ALLOW_UNLIMITED;
  }
}

/**
 * Best-effort client IP from proxy headers. Vercel/most proxies set
 * `x-forwarded-for` (a comma list, client first); `x-real-ip` is a fallback.
 * Defaults to a constant so a missing header degrades to a shared bucket rather
 * than throwing.
 */
export async function getClientIp(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return headerList.get("x-real-ip")?.trim() || "127.0.0.1";
}

/** Whole minutes until the window resets (min 1), for user-facing copy. */
export function retryAfterMinutes(reset: number): number {
  return Math.max(1, Math.ceil((reset - Date.now()) / 60_000));
}

/** Whole seconds until the window resets (min 0), for the `Retry-After` header. */
export function retryAfterSeconds(reset: number): number {
  return Math.max(0, Math.ceil((reset - Date.now()) / 1000));
}

/** Standard user-facing message: "Too many attempts. Please try again in X minutes." */
export function rateLimitMessage(reset: number): string {
  const minutes = retryAfterMinutes(reset);
  return `Too many attempts. Please try again in ${minutes} minute${
    minutes === 1 ? "" : "s"
  }.`;
}
