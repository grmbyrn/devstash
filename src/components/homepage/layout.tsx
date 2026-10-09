import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

/** Shared building blocks for the homepage sections. */

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

/**
 * Exposes an item type's color as `--accent`, so children can use
 * `bg-(--accent)` / `text-(--accent)` without a class per color.
 */
export function accentStyle(color: string): CSSProperties {
  return { "--accent": color } as CSSProperties;
}
