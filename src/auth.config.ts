import GitHub from "next-auth/providers/github";
import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible configuration: providers only, no database adapter.
 *
 * This is the base config imported by the proxy (edge runtime) and spread into
 * the full instance in `auth.ts`. It must never reference the Prisma adapter or
 * any Node-only APIs, so it stays safe to evaluate in the edge runtime.
 */
export default {
  providers: [GitHub],
} satisfies NextAuthConfig;
