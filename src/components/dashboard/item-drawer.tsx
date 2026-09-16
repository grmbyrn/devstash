"use client";

import {
  Copy,
  ExternalLink,
  FolderPlus,
  Pencil,
  Pin,
  Star,
  Tag,
  Trash2,
} from "lucide-react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { ItemDetail, ItemWithMeta } from "@/lib/db/items";
import { formatFileSize, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { ItemTypeIcon } from "./item-type-icon";

interface ItemDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The clicked card's data — renders instantly, before detail arrives. */
  preview: ItemWithMeta | null;
  /** Full detail from `/api/items/[id]`; null while loading or on error. */
  detail: ItemDetail | null;
  error: string | null;
}

export function ItemDrawer({
  open,
  onOpenChange,
  preview,
  detail,
  error,
}: ItemDrawerProps) {
  // Detail supersedes the card data once it lands; until then the card's copy
  // fills the header so opening the drawer never flashes an empty shell.
  const item = detail ?? preview;
  const isLoading = !detail && !error;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        description="Item details"
        className="w-full gap-0 overflow-y-auto sm:max-w-lg"
      >
        {item && (
          <>
            <header className="flex items-start gap-3 border-b border-border p-4 pr-12">
              <span
                className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"
                style={{ color: item.type.color }}
              >
                <ItemTypeIcon name={item.type.icon} className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <SheetTitle className="truncate text-lg font-semibold leading-tight text-foreground">
                  {item.title}
                </SheetTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {detail ? (
                    relativeTime(detail.updatedAt)
                  ) : (
                    <span className="inline-block h-3 w-20 animate-pulse rounded bg-muted align-middle" />
                  )}
                </p>
              </div>
            </header>

            <ActionBar isFavorite={item.isFavorite} isPinned={item.isPinned} />

            <div className="flex flex-col gap-5 p-4">
              {error ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </p>
              ) : isLoading ? (
                <DetailSkeleton />
              ) : (
                detail && <ItemBody item={detail} />
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Favorite / Pin / Copy / Edit / Delete.
 *
 * Every action is disabled for now — this pass builds the drawer's detail
 * display only, and the mutations behind these buttons land with the item
 * editing feature. Favorite and Pin still reflect the item's current state.
 */
function ActionBar({
  isFavorite,
  isPinned,
}: {
  isFavorite: boolean;
  isPinned: boolean;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-border px-3 py-2">
      <ActionButton
        icon={
          <Star className={cn(isFavorite && "fill-yellow-400 text-yellow-400")} />
        }
        label="Favorite"
        active={isFavorite}
      />
      <ActionButton
        icon={<Pin className={cn(isPinned && "fill-current")} />}
        label="Pin"
        active={isPinned}
      />
      <ActionButton icon={<Copy />} label="Copy" />
      <ActionButton icon={<Pencil />} label="Edit" />
      <ActionButton
        icon={<Trash2 />}
        label="Delete"
        className="ml-auto text-destructive"
      />
    </div>
  );
}

function ActionButton({
  icon,
  label,
  active = false,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled
      title={`${label} — coming soon`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0",
        active && "text-foreground",
        className,
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ItemBody({ item }: { item: ItemDetail }) {
  return (
    <>
      {item.description && (
        <p className="text-sm text-muted-foreground">{item.description}</p>
      )}

      {item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 break-all text-sm text-primary hover:underline"
        >
          <ExternalLink className="size-3.5 shrink-0" />
          {item.url}
        </a>
      )}

      {item.content && (
        <pre className="overflow-x-auto whitespace-pre-wrap wrap-break-word rounded-md bg-muted/50 p-3 font-mono text-xs leading-relaxed text-foreground">
          {item.content}
        </pre>
      )}

      {item.fileUrl && (
        <a
          href={item.fileUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm hover:bg-accent"
        >
          <span className="min-w-0 truncate">{item.fileName ?? "File"}</span>
          {item.fileSize !== null && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatFileSize(item.fileSize)}
            </span>
          )}
        </a>
      )}

      <Section icon={<Tag className="size-3.5" />} title="Tags">
        {item.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No tags yet.</p>
        )}
      </Section>

      <Section icon={<FolderPlus className="size-3.5" />} title="Collections">
        {item.collections.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {item.collections.map((collection) => (
              <span
                key={collection.id}
                className="rounded bg-muted px-2 py-0.5 text-xs text-foreground"
              >
                {collection.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Not in any collection.
          </p>
        )}
      </Section>
    </>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading item…</span>
      <div className="h-24 animate-pulse rounded-md bg-muted/50" />
      <div className="flex flex-col gap-2">
        <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        <div className="flex gap-1.5">
          <div className="h-5 w-12 animate-pulse rounded bg-muted" />
          <div className="h-5 w-16 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
