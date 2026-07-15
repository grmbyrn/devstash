import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/auth/submit-button";
import { resetPassword } from "@/actions/auth";
import { validatePasswordResetToken } from "@/lib/auth/password-reset";

export const metadata: Metadata = {
  title: "Reset password · DevStash",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  // Peek at the token (no consume) to decide whether to render the form.
  const peek = token
    ? await validatePasswordResetToken(token)
    : ({ ok: false, reason: "invalid" } as const);

  // A valid token gets the form. `error` here is a validation message bounced
  // back from the action (e.g. passwords didn't match), so re-show the form.
  if (peek.ok) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">
            Set a new password
          </h1>
          <p className="text-sm text-muted-foreground">
            Choose a new password for your DevStash account.
          </p>
        </div>

        <form action={resetPassword} className="space-y-4">
          <input type="hidden" name="token" value={token} />

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              New password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirm new password
            </label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <SubmitButton className="w-full" pendingText="Updating…">
            Update password
          </SubmitButton>
        </form>
      </div>
    );
  }

  // No token, or the token is invalid/expired — show the dead-end state with a
  // path back to request a fresh link. `error=expired` from the action counts as
  // expired too.
  const expired = peek.reason === "expired" || error === "expired";

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-6 space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">
          {expired ? "Link expired" : "Invalid link"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {expired
            ? "This password reset link has expired. Request a new one below."
            : "This password reset link is invalid or has already been used."}
        </p>
      </div>

      <Button asChild className="w-full">
        <Link href="/forgot-password">Request a new link</Link>
      </Button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link
          href="/sign-in"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
