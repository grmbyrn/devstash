import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible configuration: providers only, no database adapter.
 *
 * This is the base config imported by the proxy (edge runtime) and spread into
 * the full instance in `auth.ts`. It must never reference the Prisma adapter or
 * any Node-only APIs, so it stays safe to evaluate in the edge runtime.
 *
 * The Credentials provider here is a placeholder: its real `authorize` logic
 * needs bcrypt + Prisma (Node-only), so `auth.ts` overrides this entry with the
 * validating version. Keeping the declaration here lets the edge middleware and
 * the default sign-in page know the provider exists.
 */
export default {
  providers: [
    GitHub,
    Credentials({
      authorize: () => null,
    }),
  ],
} satisfies NextAuthConfig;
