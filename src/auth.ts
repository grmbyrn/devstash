import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/prisma";
import authConfig from "@/auth.config";

/**
 * Full NextAuth instance: the edge-safe base (`auth.config.ts`) plus the Prisma
 * adapter and a JWT session strategy. Import `auth`/`handlers`/`signIn`/`signOut`
 * from here everywhere except the proxy's edge context.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
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
  ...authConfig,
});
