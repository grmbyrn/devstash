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
export async function getItemById(
  userId: string,
  id: string,
): Promise<ItemDetail | null> {
  const row = await prisma.item.findFirst({
    where: { id, userId },
    select: {
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
    },
  });

  if (!row) return null;

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
