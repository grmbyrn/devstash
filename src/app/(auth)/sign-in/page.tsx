import type { Metadata } from "next";
import Link from "next/link";

import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/auth/submit-button";
import { GithubIcon } from "@/components/auth/github-icon";
import {
  resendVerification,
  signInWithCredentials,
  signInWithGitHub,
} from "@/actions/auth";

export const metadata: Metadata = {
  title: "Sign in · DevStash",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    registered?: string;
    verify?: string;
    verified?: string;
    resent?: string;
    reset?: string;
    email?: string;
  }>;
}) {
  const { error, registered, verify, verified, resent, reset, email } =
    await searchParams;
  const emailNotVerified = error === "EmailNotVerified";

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-6 space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to your DevStash account.
        </p>
      </div>

      {registered && (
        <p className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">
          {verify
            ? "Account created. Check your email for a verification link before signing in."
            : "Account created. Sign in to continue."}
        </p>
      )}

      {verified && (
        <p className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">
          Email verified. You can now sign in.
        </p>
      )}

      {reset && (
        <p className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">
          Password updated. Sign in with your new password.
        </p>
      )}

      {resent && (
        <p className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">
          If that email needs verifying, we&apos;ve sent a fresh link. Check your
          inbox.
        </p>
      )}

      {emailNotVerified && (
        <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
          <p>Please verify your email before signing in.</p>
          <form action={resendVerification} className="mt-2">
            <input type="hidden" name="email" value={email ?? ""} />
            <SubmitButton
              variant="outline"
              className="h-8 w-full text-xs"
              pendingText="Sending…"
            >
              Resend verification email
            </SubmitButton>
          </form>
        </div>
      )}

      <form action={signInWithGitHub}>
        <SubmitButton variant="outline" className="w-full">
          <GithubIcon className="size-4" />
          Sign in with GitHub
        </SubmitButton>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          or
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={signInWithCredentials} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />
        </div>

        {error && !emailNotVerified && (
          <p role="alert" className="text-sm text-destructive">
            Invalid email or password.
          </p>
        )}

        <SubmitButton className="w-full" pendingText="Signing in…">
          Sign in
        </SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
