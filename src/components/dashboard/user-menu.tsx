"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronsUpDown, LogOut, User as UserIcon } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { signOut } from "@/actions/auth";
import { cn } from "@/lib/utils";

export interface SidebarUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

/**
 * Sidebar user footer. The avatar/name links to `/profile`; a separate trigger
 * opens a small menu with "Sign out" (a server action). In the collapsed rail
 * the avatar itself is the menu trigger, and the menu also carries a Profile
 * link since there's no room for the name row.
 */
export function UserMenu({
  user,
  compact,
}: {
  user: SidebarUser;
  compact: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const displayName = user.name ?? "Account";

  return (
    <div
      ref={ref}
      className={cn(
        "relative border-t border-border p-3",
        compact && "flex justify-center",
      )}
    >
      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-3 right-3 mb-2 z-20 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md"
        >
          {compact && (
            <Link
              href="/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <UserIcon className="size-4 shrink-0" />
              Profile
            </Link>
          )}
          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <LogOut className="size-4 shrink-0" />
              Sign out
            </button>
          </form>
        </div>
      )}

      {compact ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Account menu"
        >
          <UserAvatar name={user.name} image={user.image} />
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <Link
            href="/profile"
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md transition-opacity hover:opacity-80"
          >
            <UserAvatar name={user.name} image={user.image} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{displayName}</div>
              {user.email && (
                <div className="truncate text-xs text-muted-foreground">
                  {user.email}
                </div>
              )}
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Account menu"
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <ChevronsUpDown className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
