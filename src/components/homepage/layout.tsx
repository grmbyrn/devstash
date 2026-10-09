import type { CSSProperties } from "react";
import Link from "next/link";
import { Layers } from "lucide-react";

import { cn } from "@/lib/utils";

/** Shared building blocks for the homepage sections. */

export function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}>{children}</div>;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <header className={cn("mx-auto mb-14 max-w-2xl text-center", className)}>
      {eyebrow && (
        <p className="mb-3 text-xs font-bold tracking-[0.12em] text-brand uppercase">{eyebrow}</p>
      )}
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {description && <p className="mt-3.5 text-lg text-muted-foreground">{description}</p>}
    </header>
  );
}

export function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 text-[1.05rem] font-bold">
      <span className="grid size-6.5 place-items-center rounded-md bg-brand-gradient text-white">
        <Layers className="size-4" aria-hidden />
      </span>
      DevStash
    </Link>
  );
}

/**
 * Exposes an item type's color as `--accent`, so children can use
 * `bg-(--accent)` / `text-(--accent)` without a class per color.
 */
export function accentStyle(color: string): CSSProperties {
  return { "--accent": color } as CSSProperties;
}
