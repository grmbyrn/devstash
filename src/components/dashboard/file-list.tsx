"use client";

import { createElement } from "react";
import { Download, Pin, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ItemWithMeta } from "@/lib/db/items";
import { fileIconFor } from "@/lib/file-icons";
import { formatDate, formatFileSize } from "@/lib/format";
import { fileUrlForKey } from "@/lib/uploads";

import { useItemDrawer } from "./item-drawer-provider";

/**
 * File items as a single-column list, like a file manager: name, size, upload
 * date and a download button per row. Clicking a row opens the item drawer.
 */
export function FileList({ items }: { items: ItemWithMeta[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card/60">
      <div
        aria-hidden
        className="hidden items-center gap-3 border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground sm:flex"
      >
        <span className="w-8 shrink-0" />
        <span className="flex-1">Name</span>
        <span className="w-20 text-right">Size</span>
        <span className="w-28 text-right">Uploaded</span>
        <span className="w-9 shrink-0" />
      </div>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <FileRow key={item.id} item={item} />
        ))}
      </ul>
    </div>
  );
}

function FileRow({ item }: { item: ItemWithMeta }) {
  const { openItem } = useItemDrawer();
  const fileName = item.fileName ?? item.title;

  return (
    <li className="relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-within:bg-muted/50">
      <span
        className="grid size-8 shrink-0 place-items-center rounded-md bg-muted"
        style={{ color: item.type.color }}
      >
        {/* createElement rather than JSX: the icon is looked up per row, and
            JSX on a call's result reads to the React compiler as a component
            declared during render. */}
        {createElement(fileIconFor(item.fileUrl), {
          className: "size-4",
          "aria-hidden": true,
        })}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-w-0 items-center gap-2">
            {/* The open button stretches over the whole row via `after:`, so
                the row is one click target while the download link, a sibling
                layered above it, stays a real link — an <a> can't nest in a
                <button>, so no propagation needs stopping. */}
            <button
              type="button"
              onClick={() => openItem(item)}
              className="min-w-0 truncate text-left text-sm font-semibold text-foreground after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-1 focus-visible:after:ring-inset focus-visible:after:ring-ring"
            >
              {item.title}
            </button>
            {item.isPinned && (
              <Pin className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            {item.isFavorite && (
              <Star className="size-3.5 shrink-0 fill-yellow-400 text-yellow-400" />
            )}
          </div>
          {fileName !== item.title && (
            <span className="truncate font-mono text-xs text-muted-foreground">
              {fileName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:gap-3">
          <span className="sm:w-20 sm:text-right">
            {item.fileSize !== null && formatFileSize(item.fileSize)}
          </span>
          <span aria-hidden className="sm:hidden">
            ·
          </span>
          <time dateTime={item.createdAt} className="sm:w-28 sm:text-right">
            {formatDate(item.createdAt)}
          </time>
        </div>
      </div>

      {item.fileUrl && (
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="relative z-10 shrink-0 text-muted-foreground"
        >
          {/* `download` plus the route's attachment disposition, so a PDF
              saves rather than replacing the page. */}
          <a
            href={fileUrlForKey(item.fileUrl, true)}
            download={fileName}
            aria-label={`Download ${fileName}`}
            title="Download"
          >
            <Download />
          </a>
        </Button>
      )}
    </li>
  );
}
