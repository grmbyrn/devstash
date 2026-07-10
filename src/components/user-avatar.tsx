import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Derive up-to-two-letter initials from a display name.
 * "Brad Traversy" → "BT", "cher" → "C", empty/nullish → "?".
 */
export function getInitials(name?: string | null): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return "?";
  return parts
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Reusable avatar. Renders the user's `image` (e.g. a GitHub photo) when
 * present, otherwise falls back to initials derived from the name. Plain
 * component with no hooks, so it works in both server and client trees.
 */
export function UserAvatar({
  name,
  image,
  size = 32,
  className,
}: {
  name?: string | null;
  image?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-xs font-medium text-muted-foreground",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {image ? (
        <Image
          src={image}
          alt={name ?? "User avatar"}
          width={size}
          height={size}
          className="size-full object-cover"
        />
      ) : (
        getInitials(name)
      )}
    </span>
  );
}
