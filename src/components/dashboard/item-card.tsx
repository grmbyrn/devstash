import { Pin, Star } from "lucide-react";

import type { ItemWithMeta } from "@/lib/db/items";

import { ItemTypeIcon } from "./item-type-icon";

export function ItemCard({ item }: { item: ItemWithMeta }) {
  const accent = item.type.color;
  const preview = item.content?.trim() ?? item.url ?? item.description ?? "";

  return (
    <article
      className="relative flex flex-col gap-2 rounded-lg border border-border bg-card/60 p-4 pl-5 transition-colors hover:bg-card"
      style={{ borderLeftWidth: 3, borderLeftColor: accent }}
    >
      <div className="flex items-start gap-2">
        <span
          className="grid size-6 shrink-0 place-items-center rounded-md bg-muted"
          style={{ color: accent }}
        >
          <ItemTypeIcon name={item.type.icon} className="size-3.5" />
        </span>
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {item.title}
        </h3>
        <div className="flex shrink-0 items-center gap-1 text-muted-foreground">
          {item.isPinned && <Pin className="size-3.5" />}
          {item.isFavorite && (
            <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
          )}
        </div>
      </div>

      {preview && (
        <pre className="line-clamp-3 whitespace-pre-wrap break-words rounded-md bg-muted/50 px-2 py-1.5 font-mono text-[11px] leading-snug text-muted-foreground">
          {preview}
        </pre>
      )}

      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
