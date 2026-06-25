import Link from "next/link";

import type { CollectionWithMeta } from "@/lib/db/collections";

import { ItemTypeIcon } from "./item-type-icon";

export function CollectionCard({
  collection,
}: {
  collection: CollectionWithMeta;
}) {
  const count = collection.itemCount;
  const accent = collection.accentType?.color ?? "var(--color-muted-foreground)";

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
        {collection.types.length > 0 && (
          <div className="flex shrink-0 gap-1">
            {collection.types.map((type) => (
              <span
                key={type.id}
                title={type.name}
                className="grid size-6 place-items-center rounded-md bg-muted"
                style={{ color: type.color }}
              >
                <ItemTypeIcon name={type.icon} className="size-3.5" />
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="mt-auto text-xs text-muted-foreground">
        {count} {count === 1 ? "item" : "items"}
      </div>
    </Link>
  );
}
