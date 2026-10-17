"use client";

import * as React from "react";
import { Check, Copy, Pin, Star } from "lucide-react";
import { toast } from "sonner";

import type { ItemWithMeta } from "@/lib/db/items";
import { quickCopyValue } from "@/lib/item-types";
import { cn } from "@/lib/utils";

import { ImageCard } from "./image-card";
import { useItemDrawer } from "./item-drawer-provider";
import { ItemTypeIcon } from "./item-type-icon";

/**
 * Picks the card for an item's type, so every grid gets the image gallery card
 * without its call site having to know which types it holds.
 */
export function ItemCard({ item }: { item: ItemWithMeta }) {
  return item.type.name === "image" ? (
    <ImageCard item={item} />
  ) : (
    <TextItemCard item={item} />
  );
}

function TextItemCard({ item }: { item: ItemWithMeta }) {
  const { openItem } = useItemDrawer();
  const accent = item.type.color;
  const preview = item.content?.trim() ?? item.url ?? item.description ?? "";
  const copyValue = quickCopyValue(item);

  return (
    // The copy button is a sibling layered over the card rather than a child,
    // since a <button> can't nest inside another.
    <div className="group relative">
      {/* A button rather than a click handler on the article, so the card is
        reachable and activatable from the keyboard for free. */}
      <button
        type="button"
        onClick={() => openItem(item)}
        className="relative flex size-full flex-col gap-2 rounded-lg border border-border bg-card/60 p-4 pl-5 text-left transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
          <div
            className={cn(
              "flex shrink-0 items-center gap-1 text-muted-foreground",
              copyValue && "mr-7",
            )}
          >
            {item.isPinned && <Pin className="size-3.5" />}
            {item.isFavorite && (
              <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
            )}
          </div>
        </div>

        {preview && (
          // The padding lives on the wrapper, not the clamped element: `overflow`
          // clips at the padding box, so padding on the <pre> itself would let a
          // sliver of the 4th line bleed into the gap below the clamp.
          <div className="rounded-md bg-muted/50 px-2 py-1.5">
            <pre className="line-clamp-3 whitespace-pre-wrap wrap-break-word font-mono text-[11px] leading-snug text-muted-foreground">
              {preview}
            </pre>
          </div>
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
      </button>
      {copyValue && <QuickCopyButton value={copyValue} title={item.title} />}
    </div>
  );
}

function QuickCopyButton({ value, title }: { value: string; title: string }) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Copied" : "Copy"}
      aria-label={copied ? "Copied" : `Copy ${title}`}
      // Revealed on card hover or keyboard focus; always shown on touch
      // screens, which have no hover to reveal it.
      className="absolute top-4 right-4 grid size-6 cursor-pointer place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-hover:opacity-100 [@media(hover:none)]:opacity-100"
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-400" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
}
