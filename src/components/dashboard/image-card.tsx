"use client";

import * as React from "react";
import { ImageOff, Pin, Star } from "lucide-react";

import type { ItemWithMeta } from "@/lib/db/items";
import { fileUrlForKey, isPreviewableImage } from "@/lib/uploads";

import { useItemDrawer } from "./item-drawer-provider";

/**
 * The gallery card for image items: a 16:9 thumbnail above the title.
 *
 * `item.fileUrl` is the R2 object key, read back through the authenticated
 * `/api/files` proxy. The extension check runs on the key, whose extension was
 * validated at upload, rather than on the client-supplied `fileName`.
 */
export function ImageCard({ item }: { item: ItemWithMeta }) {
  const { openItem } = useItemDrawer();
  const [failed, setFailed] = React.useState(false);

  const key = item.fileUrl;
  const showImage = key !== null && isPreviewableImage(key) && !failed;

  return (
    <button
      type="button"
      onClick={() => openItem(item)}
      className="group flex w-full flex-col overflow-hidden rounded-lg border border-border bg-card/60 text-left transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-muted/40">
        {showImage ? (
          // Deliberately not `next/image`: the optimizer fetches the source
          // server-side without the viewer's cookies, so the authenticated proxy
          // would answer it with a 401. A plain <img> carries the session.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fileUrlForKey(key)}
            alt={item.title}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="size-full object-cover transition-transform duration-300 ease-out motion-safe:group-hover:scale-105"
          />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <ImageOff className="size-6" aria-hidden />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 px-3 py-2.5">
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
    </button>
  );
}
