import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  /**
   * Returned by `auth`, `useSession`, `getSession` and received as a prop on
   * the `SessionProvider` React Context.
   */
  interface Session {
    user: {
      /** The user's database id. */
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  /** Extends the JWT with the user's database id. */
  interface JWT {
    id?: string;
  }
}
