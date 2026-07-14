"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn, signOut as nextAuthSignOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { registerUser } from "@/lib/auth/register";
import {
  isEmailVerificationEnabled,
  issueEmailVerification,
} from "@/lib/auth/verification";

const DASHBOARD = "/dashboard";

/** GitHub OAuth sign-in. Redirects to the provider, then back to the dashboard. */
export async function signInWithGitHub() {
  await signIn("github", { redirectTo: DASHBOARD });
}

/** Sign out and return to the sign-in page. */
export async function signOut() {
  await nextAuthSignOut({ redirectTo: "/sign-in" });
}

/**
 * Email/password sign-in. On success NextAuth throws a redirect to the
 * dashboard (re-thrown so it propagates); a failed `authorize` throws an
 * `AuthError`, which we translate into a redirect back to the sign-in page with
 * an error flag the page renders.
 */
export async function signInWithCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", { email, password, redirectTo: DASHBOARD });
  } catch (error) {
    if (error instanceof AuthError) {
      // `authorize` blocks unverified accounts the same way it blocks a bad
      // password (returns null). Re-check here so we can steer unverified users
      // to the resend flow instead of showing "invalid email or password".
      if (isEmailVerificationEnabled()) {
        const user = await prisma.user.findUnique({
          where: { email },
          select: { password: true, emailVerified: true },
        });
        if (user?.password && !user.emailVerified) {
          redirect(
            `/sign-in?error=EmailNotVerified&email=${encodeURIComponent(email)}`,
          );
        }
      }
      redirect("/sign-in?error=CredentialsSignin");
    }
    throw error;
  }
}

/**
 * Re-issue a verification email. Always redirects to the same confirmation
 * regardless of whether the address maps to an unverified account, so the form
 * can't be used to probe which emails are registered.
 */
export async function resendVerification(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  // Nothing to resend when the verification system is switched off.
  if (email && isEmailVerificationEnabled()) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { name: true, email: true, password: true, emailVerified: true },
    });
    // Only credentials accounts that haven't verified yet get a new link.
    if (user?.email && user.password && !user.emailVerified) {
      try {
        await issueEmailVerification(user.email, user.name);
      } catch (error) {
        console.error("Failed to resend verification email:", error);
      }
    }
  }

  redirect("/sign-in?resent=1");
}

/**
 * Register a new account, then redirect to the sign-in page. Validation and
 * duplicate-email errors redirect back to `/register` with the message so the
 * server-rendered page can display it.
 */
export async function register(formData: FormData) {
  const result = await registerUser({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (!result.success) {
    redirect(`/register?error=${encodeURIComponent(result.error)}`);
  }

  // With verification on, tell the user to check their inbox; with it off the
  // account is ready to use immediately.
  redirect(
    isEmailVerificationEnabled()
      ? "/sign-in?registered=1&verify=1"
      : "/sign-in?registered=1",
  );
}
