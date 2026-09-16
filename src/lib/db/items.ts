import { cache } from "react";
import type { ContentType } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

/** The item type metadata a card needs to render its icon and accent. */
export interface ItemTypeSummary {
  id: string;
  name: string;
  icon: string;
  color: string;
}

/** An item enriched with the data the dashboard card needs to render. */
export interface ItemWithMeta {
  id: string;
  title: string;
  content: string | null;
  url: string | null;
  description: string | null;
  isFavorite: boolean;
  isPinned: boolean;
  language: string | null;
  type: ItemTypeSummary;
  /** Tag names, ordered as returned by the database. */
  tags: string[];
}

// Shared shape for the item + its type + tag names, so every fetcher returns
// exactly the fields a card renders.
const itemCardSelect = {
  id: true,
  title: true,
  content: true,
  url: true,
  description: true,
  isFavorite: true,
  isPinned: true,
  language: true,
  itemType: { select: { id: true, name: true, icon: true, color: true } },
  tags: { select: { tag: { select: { name: true } } } },
} as const;

type ItemCardRow = {
  id: string;
  title: string;
  content: string | null;
  url: string | null;
  description: string | null;
  isFavorite: boolean;
  isPinned: boolean;
  language: string | null;
  itemType: ItemTypeSummary;
  tags: { tag: { name: string } }[];
};

function toItemWithMeta(row: ItemCardRow): ItemWithMeta {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    url: row.url,
    description: row.description,
    isFavorite: row.isFavorite,
    isPinned: row.isPinned,
    language: row.language,
    type: row.itemType,
    tags: row.tags.map((t) => t.tag.name),
  };
}

/** A user's pinned items, most recently updated first. */
export async function getPinnedItems(userId: string): Promise<ItemWithMeta[]> {
  const rows = await prisma.item.findMany({
    where: { userId, isPinned: true },
    orderBy: { updatedAt: "desc" },
    select: itemCardSelect,
  });

  return rows.map(toItemWithMeta);
}

/**
 * A user's most recently used items. Falls back to `updatedAt` for items that
 * have never been opened (no `lastUsedAt`), so freshly seeded data surfaces.
 */
export async function getRecentItems(
  userId: string,
  limit = 10,
): Promise<ItemWithMeta[]> {
  const rows = await prisma.item.findMany({
    where: { userId },
    orderBy: [
      { lastUsedAt: { sort: "desc", nulls: "last" } },
      { updatedAt: "desc" },
    ],
    take: limit,
    select: itemCardSelect,
  });

  return rows.map(toItemWithMeta);
}

/**
 * Every item of one type belonging to one user, for the `/items/[type]` list.
 * Pinned items lead, then most recently used, falling back to `updatedAt` for
 * items that have never been opened.
 */
export async function getItemsByType(
  userId: string,
  itemTypeId: string,
): Promise<ItemWithMeta[]> {
  const rows = await prisma.item.findMany({
    where: { userId, itemTypeId },
    orderBy: [
      { isPinned: "desc" },
      { lastUsedAt: { sort: "desc", nulls: "last" } },
      { updatedAt: "desc" },
    ],
    select: itemCardSelect,
  });

  return rows.map(toItemWithMeta);
}

// Canonical display order for the seeded system types; anything unknown
// (e.g. future custom types) sorts to the end.
const SYSTEM_TYPE_ORDER = [
  "snippet",
  "prompt",
  "command",
  "note",
  "link",
  "file",
  "image",
];

/**
 * The system item types for the sidebar type list, in canonical order.
 *
 * Wrapped in React's `cache()` so the layout's sidebar, the `/items/[type]`
 * page and its `generateMetadata` all share one query per request — takes no
 * arguments, so every caller hits the same cache entry.
 */
export const getSystemItemTypes = cache(async function getSystemItemTypes(): Promise<
  ItemTypeSummary[]
> {
  const types = await prisma.itemType.findMany({
    where: { isSystem: true },
    select: { id: true, name: true, icon: true, color: true },
  });

  return types.sort((a, b) => {
    const rankA = SYSTEM_TYPE_ORDER.indexOf(a.name);
    const rankB = SYSTEM_TYPE_ORDER.indexOf(b.name);
    return (
      (rankA === -1 ? SYSTEM_TYPE_ORDER.length : rankA) -
      (rankB === -1 ? SYSTEM_TYPE_ORDER.length : rankB)
    );
  });
});

/** Aggregate item stats for a user's dashboard stat cards. */
export async function getItemStats(userId: string): Promise<{
  total: number;
  favorites: number;
}> {
  const [total, favorites] = await Promise.all([
    prisma.item.count({ where: { userId } }),
    prisma.item.count({ where: { userId, isFavorite: true } }),
  ]);

  return { total, favorites };
}

/** A collection an item belongs to, reduced to what the drawer renders. */
export interface ItemCollectionSummary {
  id: string;
  name: string;
}

/**
 * The full detail the item drawer renders: everything a card shows plus the
 * body content, file metadata, the collections it belongs to, and timestamps.
 */
export interface ItemDetail extends ItemWithMeta {
  contentType: ContentType;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  collections: ItemCollectionSummary[];
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}

/**
 * One item's full detail, for `GET /api/items/[id]`.
 *
 * Scoped to `userId` in the `where` clause rather than fetched then checked, so
 * another user's item is simply absent — the route turns that into a 404, which
 * never reveals whether the id exists at all.
 *
 * Dates are serialized to ISO strings because this crosses the network to a
 * client component, where `Date` instances do not survive JSON.
 */
const itemDetailSelect = {
  ...itemCardSelect,
  contentType: true,
  fileUrl: true,
  fileName: true,
  fileSize: true,
  createdAt: true,
  updatedAt: true,
  lastUsedAt: true,
  collections: {
    orderBy: { addedAt: "asc" },
    select: { collection: { select: { id: true, name: true } } },
  },
} as const;

type ItemDetailRow = ItemCardRow & {
  contentType: ContentType;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date | null;
  collections: { collection: ItemCollectionSummary }[];
};

function toItemDetail(row: ItemDetailRow): ItemDetail {
  return {
    ...toItemWithMeta(row),
    contentType: row.contentType,
    fileUrl: row.fileUrl,
    fileName: row.fileName,
    fileSize: row.fileSize,
    collections: row.collections.map((c) => c.collection),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  };
}

export async function getItemById(
  userId: string,
  id: string,
): Promise<ItemDetail | null> {
  const row = await prisma.item.findFirst({
    where: { id, userId },
    select: itemDetailSelect,
  });

  if (!row) return null;

  return toItemDetail(row);
}

/** The columns `updateItem` may write. Absent keys are left untouched. */
export interface UpdateItemData {
  title: string;
  description?: string | null;
  content?: string | null;
  language?: string | null;
  url?: string | null;
  tags?: string[];
}

/**
 * Apply an edit to one item and return its refreshed detail.
 *
 * Ownership is enforced the same way `getItemById` does it — `userId` sits in
 * the `where` clause rather than being checked after a read — so another user's
 * item is never updated and is reported as simply absent (`null`), which the
 * caller turns into a "not found" without revealing that the id exists.
 *
 * Tags are replaced wholesale: the join rows are deleted and recreated,
 * connecting to existing `Tag` rows by name or creating them. `Tag` is global
 * and shared across users, so `connectOrCreate` is what keeps one name to one
 * row. Tags left with no items are not cleaned up here.
 *
 * The write and the tag replacement are one nested Prisma call, so a failure
 * part-way cannot leave the item updated with its old tags.
 */
export async function updateItem(
  userId: string,
  id: string,
  data: UpdateItemData,
): Promise<ItemDetail | null> {
  const { tags, ...fields } = data;

  // Only keys actually present are written, so a payload that omits `url`
  // leaves the existing value alone instead of nulling it.
  const scalars = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );

  try {
    const row = await prisma.item.update({
      // `id` alone is unique; `userId` narrows it so a foreign item matches
      // nothing and Prisma raises P2025 rather than writing.
      where: { id, userId },
      data: {
        ...scalars,
        ...(tags
          ? {
              tags: {
                deleteMany: {},
                create: tags.map((name) => ({
                  tag: {
                    connectOrCreate: { where: { name }, create: { name } },
                  },
                })),
              },
            }
          : {}),
      },
      select: itemDetailSelect,
    });

    return toItemDetail(row);
  } catch (error) {
    // P2025 is "record to update not found" — either the id is unknown or it
    // belongs to someone else. Both are reported as absent, so the caller
    // cannot tell them apart. Anything else is a real failure worth raising.
    if (isRecordNotFound(error)) return null;
    throw error;
  }
}

/** True for Prisma's "record not found" error, without importing its namespace. */
function isRecordNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2025"
  );
}
