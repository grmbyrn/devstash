import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FolderOpen, Library } from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProfileStats } from "@/lib/db/profile";
import { UserAvatar } from "@/components/user-avatar";
import { StatCard } from "@/components/dashboard/stat-card";
import { ItemTypeIcon } from "@/components/dashboard/item-type-icon";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/auth/submit-button";
import { DeleteAccount } from "@/components/profile/delete-account";
import { changePassword } from "@/actions/profile";

export const metadata: Metadata = {
  title: "Profile · DevStash",
};

const joinedFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "long" });

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{
    pwSuccess?: string;
    pwError?: string;
    deleteError?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=/profile");
  }

  const { pwSuccess, pwError, deleteError } = await searchParams;

  const [user, stats] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        image: true,
        createdAt: true,
        password: true,
      },
    }),
    getProfileStats(session.user.id),
  ]);

  if (!user) {
    // Session references a user that no longer exists (e.g. deleted elsewhere).
    redirect("/sign-in");
  }

  // Only credentials accounts have a password to change; never forward the hash.
  const hasPassword = Boolean(user.password);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>
      </div>

      {/* Identity */}
      <header className="flex items-center gap-4">
        <UserAvatar name={user.name} image={user.image} size={64} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {user.name ?? "Your account"}
          </h1>
          {user.email && (
            <p className="truncate text-sm text-muted-foreground">
              {user.email}
            </p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            Joined {joinedFormatter.format(user.createdAt)}
          </p>
        </div>
      </header>

      {/* Usage stats */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Usage
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Items" value={stats.totalItems} icon={Library} />
          <StatCard
            label="Collections"
            value={stats.totalCollections}
            icon={FolderOpen}
          />
        </div>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {stats.breakdown.map((type) => (
            <li
              key={type.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2"
            >
              <span
                className="grid size-7 shrink-0 place-items-center rounded-md"
                style={{ backgroundColor: `${type.color}1a`, color: type.color }}
              >
                <ItemTypeIcon name={type.icon} className="size-4" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm capitalize">
                {type.name}
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {type.count}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Change password — credentials accounts only */}
      {hasPassword && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Change password
          </h2>
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            {pwSuccess && (
              <p className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">
                Password updated.
              </p>
            )}
            {pwError && (
              <p
                role="alert"
                className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {pwError}
              </p>
            )}

            <form action={changePassword} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="currentPassword"
                  className="text-sm font-medium"
                >
                  Current password
                </label>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="newPassword" className="text-sm font-medium">
                  New password
                </label>
                <Input
                  id="newPassword"
                  name="newPassword"
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

              <SubmitButton className="w-full sm:w-auto" pendingText="Updating…">
                Update password
              </SubmitButton>
            </form>
          </div>
        </section>
      )}

      {/* Danger zone */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-destructive">
          Danger zone
        </h2>
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
          <h3 className="text-sm font-semibold">Delete account</h3>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            Permanently delete your account and everything in it — items,
            collections, and settings. This can&apos;t be undone.
          </p>

          {deleteError && (
            <p
              role="alert"
              className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {deleteError}
            </p>
          )}

          <div className="mt-4">
            <DeleteAccount email={user.email ?? ""} />
          </div>
        </div>
      </section>
    </div>
  );
}
