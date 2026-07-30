import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** The signed-in user's id, confirmed to still exist in the database. */
export interface VerifiedUser {
  id: string;
}

/**
 * Guard for pages that read user-owned data.
 *
 * Sessions use the JWT strategy, so the cookie carries the user id and is
 * accepted without ever touching the database — which means a session outlives
 * the account it belongs to (deleted here, or wiped by a branch reset). Pages
 * that only query by `userId` would then render a convincingly empty view for
 * a user that no longer exists, so confirm the row is really there and send
 * stale sessions back to sign-in.
 *
 * Costs one primary-key lookup; `/profile` pays the same price inline because
 * it already loads the full user row.
 *
 * @param callbackUrl Path to return to after signing in.
 */
export async function requireUser(callbackUrl: string): Promise<VerifiedUser> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });
  if (!user) {
    redirect("/sign-in");
  }

  return user;
}
