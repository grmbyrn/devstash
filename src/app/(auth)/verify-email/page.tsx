import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/auth/submit-button";
import { resendVerification } from "@/actions/auth";
import { consumeVerificationToken } from "@/lib/auth/verification";

export const metadata: Metadata = {
  title: "Verify email · DevStash",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  const result = token
    ? await consumeVerificationToken(token)
    : ({ ok: false, reason: "invalid" } as const);

  // On success, hand off to sign-in with a confirmation banner.
  if (result.ok) {
    redirect("/sign-in?verified=1");
  }

  const expired = result.reason === "expired";

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-6 space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">
          {expired ? "Link expired" : "Invalid link"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {expired
            ? "This verification link has expired. Request a new one below."
            : "This verification link is invalid or has already been used."}
        </p>
      </div>

      <form action={resendVerification} className="space-y-4">
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

        <SubmitButton className="w-full" pendingText="Sending…">
          Send a new verification link
        </SubmitButton>
      </form>

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
