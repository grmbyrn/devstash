import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import authConfig from "@/auth.config";
import { signInSchema } from "@/lib/validations/auth";

/**
 * Real Credentials provider: validates the submitted email/password against the
 * bcrypt hash stored on the user. Lives here (not in `auth.config.ts`) because
 * bcrypt + Prisma are Node-only and would break the edge middleware.
 */
const credentialsProvider = Credentials({
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  authorize: async (credentials) => {
    const parsed = signInSchema.safeParse(credentials);
    if (!parsed.success) return null;

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    // OAuth-only users have no password hash and can't sign in this way.
    if (!user?.password) return null;

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) return null;

    // Credentials accounts must confirm their email before signing in. The
    // sign-in action distinguishes this from a bad password (see auth actions).
    if (!user.emailVerified) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    };
  },
});

/**
 * Full NextAuth instance: the edge-safe base (`auth.config.ts`) plus the Prisma
 * adapter and a JWT session strategy. Import `auth`/`handlers`/`signIn`/`signOut`
 * from here everywhere except the proxy's edge context.
 *
 * The Credentials placeholder from `authConfig` is swapped for the validating
 * `credentialsProvider`; every other provider (e.g. GitHub) passes through.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: authConfig.providers.map((provider) =>
    typeof provider !== "function" && provider.id === "credentials"
      ? credentialsProvider
      : provider,
  ),
  callbacks: {
    jwt({ token, user }) {
      // `user` is only present on initial sign-in.
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
