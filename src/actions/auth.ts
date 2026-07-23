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
import {
  issuePasswordReset,
  resetUserPassword,
} from "@/lib/auth/password-reset";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";
import {
  checkRateLimit,
  getClientIp,
  rateLimitMessage,
  retryAfterMinutes,
} from "@/lib/rate-limit";

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

  // Rate limit by IP + email so brute forcing one account is throttled without
  // one attacker blocking every account from a shared IP outright.
  const ip = await getClientIp();
  const limit = await checkRateLimit("login", `${ip}:${email.toLowerCase()}`);
  if (!limit.success) {
    redirect(
      `/sign-in?error=RateLimited&retryMins=${retryAfterMinutes(limit.reset)}`,
    );
  }

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

  // Throttle by IP + email to curb inbox-flooding a single address.
  const ip = await getClientIp();
  const limit = await checkRateLimit(
    "resendVerification",
    `${ip}:${email.toLowerCase()}`,
  );
  if (!limit.success) {
    redirect(
      `/sign-in?error=RateLimited&retryMins=${retryAfterMinutes(limit.reset)}`,
    );
  }

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
 * Send a password-reset link. Always redirects to the same confirmation whether
 * or not the address maps to a credentials account, so the form can't be used to
 * probe which emails are registered.
 */
export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  // IP-keyed — the limit doesn't depend on which account, so it can't be used to
  // probe account existence (that's still guarded by the neutral confirmation).
  const ip = await getClientIp();
  const limit = await checkRateLimit("forgotPassword", ip);
  if (!limit.success) {
    redirect(
      `/forgot-password?error=${encodeURIComponent(rateLimitMessage(limit.reset))}`,
    );
  }

  const parsed = forgotPasswordSchema.safeParse({ email });
  if (parsed.success) {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { name: true, email: true, password: true },
    });
    // Only accounts with a password (credentials sign-ups) can reset one;
    // OAuth-only users have nothing to reset.
    if (user?.email && user.password) {
      try {
        await issuePasswordReset(user.email, user.name);
      } catch (error) {
        console.error("Failed to send password reset email:", error);
      }
    }
  }

  redirect("/forgot-password?sent=1");
}

/**
 * Set a new password from a reset link. Validation errors redirect back to the
 * form (token preserved) with the message; a token that went bad between load and
 * submit redirects to the invalid-link state. On success the token is burned and
 * the user is sent to sign-in with a confirmation banner.
 */
export async function resetPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  // IP-keyed — throttles guessing/replaying reset tokens. Preserve the token so a
  // legitimate user just sees the message and can retry once the window clears.
  const ip = await getClientIp();
  const limit = await checkRateLimit("resetPassword", ip);
  if (!limit.success) {
    redirect(
      `/reset-password?token=${encodeURIComponent(token)}&error=${encodeURIComponent(rateLimitMessage(limit.reset))}`,
    );
  }

  const parsed = resetPasswordSchema.safeParse({ password, confirmPassword });
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    redirect(
      `/reset-password?token=${encodeURIComponent(token)}&error=${encodeURIComponent(message)}`,
    );
  }

  const result = await resetUserPassword(token, parsed.data.password);
  if (!result.ok) {
    // Token expired or was consumed between page load and submit — drop the
    // token so the reset page renders the invalid-link state.
    redirect(`/reset-password?error=${result.reason}`);
  }

  redirect("/sign-in?reset=1");
}

/**
 * Register a new account, then redirect to the sign-in page. Validation and
 * duplicate-email errors redirect back to `/register` with the message so the
 * server-rendered page can display it.
 */
export async function register(formData: FormData) {
  // IP-keyed — throttles automated sign-up spam / account-creation abuse.
  const ip = await getClientIp();
  const limit = await checkRateLimit("register", ip);
  if (!limit.success) {
    redirect(`/register?error=${encodeURIComponent(rateLimitMessage(limit.reset))}`);
  }

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
