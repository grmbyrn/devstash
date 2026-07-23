"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { changePasswordSchema } from "@/lib/validations/auth";

/**
 * Change the signed-in user's password. Requires the current password (verified
 * with bcrypt) before setting the new one, so a session alone can't rotate
 * credentials. Feedback is surfaced via `/profile` query flags the page renders.
 */
export async function changePassword(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/profile");

  const parsed = changePasswordSchema.safeParse({
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    redirect(`/profile?pwError=${encodeURIComponent(message)}`);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  });
  // OAuth-only accounts have no password to change.
  if (!user?.password) {
    redirect(
      `/profile?pwError=${encodeURIComponent("Password change isn't available for this account.")}`,
    );
  }

  const matches = await bcrypt.compare(
    parsed.data.currentPassword,
    user.password,
  );
  if (!matches) {
    redirect(
      `/profile?pwError=${encodeURIComponent("Current password is incorrect.")}`,
    );
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { password: newHash },
  });

  redirect("/profile?pwSuccess=1");
}

/**
 * Permanently delete the signed-in user's account. The typed confirmation must
 * match the account email exactly (guards against accidental deletion); the
 * cascade rules in the schema drop the user's items, collections, sessions, etc.
 * On success the session is cleared and the user leaves for the home page.
 */
export async function deleteAccount(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/profile");

  const confirmation = String(formData.get("confirmEmail") ?? "").trim();
  const email = session.user.email ?? "";
  if (!email || confirmation.toLowerCase() !== email.toLowerCase()) {
    redirect(
      `/profile?deleteError=${encodeURIComponent("Type your email exactly to confirm deletion.")}`,
    );
  }

  await prisma.user.delete({ where: { id: session.user.id } });

  // Clears the session cookie and redirects (throws NEXT_REDIRECT).
  await signOut({ redirectTo: "/" });
}
