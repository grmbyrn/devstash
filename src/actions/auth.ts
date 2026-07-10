"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn, signOut as nextAuthSignOut } from "@/auth";
import { registerUser } from "@/lib/auth/register";

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
      redirect("/sign-in?error=CredentialsSignin");
    }
    throw error;
  }
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

  redirect("/sign-in?registered=1");
}
