import Link from "next/link";

import type { Collection, ItemType } from "@/lib/mock-data";

import { ItemTypeIcon } from "./item-type-icon";

export function CollectionCard({
  collection,
  accentType,
}: {
  collection: Collection;
  accentType: ItemType | undefined;
}) {
  const count = collection.itemIds.length;
  const accent = accentType?.color ?? "var(--color-muted-foreground)";

  return (
    <Link
      href={`/collections/${collection.id}`}
      className="group relative flex flex-col gap-2 overflow-hidden rounded-lg border border-border bg-card/60 p-4 transition-colors hover:bg-card"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: accent }}
      />
      <div className="flex items-start justify-between gap-2 pt-1">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">
            {collection.name}
          </div>
          {collection.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {collection.description}
            </p>
          )}
        </div>
        {accentType && (
          <span
            className="grid size-6 shrink-0 place-items-center rounded-md bg-muted"
            style={{ color: accent }}
          >
            <ItemTypeIcon name={accentType.icon} className="size-3.5" />
          </span>
        )}
      </div>
      <div className="mt-auto text-xs text-muted-foreground">
        {count} {count === 1 ? "item" : "items"}
      </div>
    </Link>
  );
}
