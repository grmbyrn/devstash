import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { RECENT_COLLECTIONS_LIMIT } from "@/lib/constants";

/** A single item type present in a collection, with its display metadata. */
export interface CollectionTypeSummary {
  id: string;
  name: string;
  icon: string;
  color: string;
}

/** A collection enriched with the data the dashboard card needs to render. */
export interface CollectionWithMeta {
  id: string;
  name: string;
  description: string | null;
  isFavorite: boolean;
  itemCount: number;
  /** Most-used item type in the collection; drives the card accent color. */
  accentType: CollectionTypeSummary | null;
  /** Distinct item types in the collection, ordered most-used first. */
  types: CollectionTypeSummary[];
}

/**
 * A user's collections, most recently updated first, each enriched with its
 * item count and the item types it contains (ranked by frequency). Omitting
 * `take` returns every collection.
 */
async function findCollectionsWithMeta(
  userId: string,
  take?: number,
): Promise<CollectionWithMeta[]> {
  const collections = await prisma.collection.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take,
    include: {
      _count: { select: { items: true } },
      defaultType: { select: { id: true, name: true, icon: true, color: true } },
      items: {
        include: {
          item: {
            select: {
              itemType: {
                select: { id: true, name: true, icon: true, color: true },
              },
            },
          },
        },
      },
    },
  });

  return collections.map((collection) => {
    // Tally how many items use each type, preserving the type's metadata.
    const counts = new Map<
      string,
      { type: CollectionTypeSummary; count: number }
    >();
    for (const { item } of collection.items) {
      const type = item.itemType;
      const entry = counts.get(type.id);
      if (entry) entry.count += 1;
      else counts.set(type.id, { type, count: 1 });
    }

    const ranked = [...counts.values()].sort((a, b) => b.count - a.count);
    const accentType = ranked[0]?.type ?? collection.defaultType ?? null;

    return {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      isFavorite: collection.isFavorite,
      itemCount: collection._count.items,
      accentType,
      types: ranked.map((entry) => entry.type),
    };
  });
}

/**
 * Fetch a user's most recently updated collections for the dashboard grid and
 * the sidebar's Recent list.
 *
 * Wrapped in React's `cache()` so the sidebar (layout) and the main grid (page)
 * share a single DB round trip per request as long as they pass the same args.
 *
 * Note: `cache()` keys on the *raw arguments*, not the resolved default — so any
 * new caller must pass `RECENT_COLLECTIONS_LIMIT` explicitly to share the cache;
 * calling `getRecentCollections(userId)` with no limit creates a separate entry.
 */
export const getRecentCollections = cache(async function getRecentCollections(
  userId: string,
  limit = RECENT_COLLECTIONS_LIMIT,
): Promise<CollectionWithMeta[]> {
  return findCollectionsWithMeta(userId, limit);
});

/** Every collection a user owns, for the `/collections` page. */
export async function getAllCollections(
  userId: string,
): Promise<CollectionWithMeta[]> {
  return findCollectionsWithMeta(userId);
}

/** A single collection as its own page's header renders it. */
export interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
}

/**
 * One collection by id, for `/collections/[id]`. Ownership sits in the `where`
 * clause, so another user's collection is simply absent and the page answers
 * 404 exactly as it does for an unknown id.
 *
 * Wrapped in `cache()` so the page and its `generateMetadata` share one query.
 */
export const getCollectionById = cache(async function getCollectionById(
  userId: string,
  id: string,
): Promise<CollectionSummary | null> {
  return prisma.collection.findFirst({
    where: { id, userId },
    select: { id: true, name: true, description: true },
  });
});

/** A collection reduced to what the sidebar link needs to render. */
export interface SidebarCollection {
  id: string;
  name: string;
}

/** A user's favorite collections for the sidebar, newest first. */
export async function getFavoriteCollections(
  userId: string,
  limit = 10,
): Promise<SidebarCollection[]> {
  return prisma.collection.findMany({
    where: { userId, isFavorite: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { id: true, name: true },
  });
}

/** A collection as the item forms offer it for selection. */
export interface CollectionOption {
  id: string;
  name: string;
}

/**
 * Every collection a user owns, alphabetically, for the item forms' collection
 * picker. Unlike the sidebar lists this is not limited — the picker has to
 * offer all of them, or an item could belong to a collection it can't show.
 *
 * Wrapped in `cache()` like `getRecentCollections`, so the layout and any page
 * asking in the same render share one query.
 */
export const getCollectionOptions = cache(async function getCollectionOptions(
  userId: string,
): Promise<CollectionOption[]> {
  return prisma.collection.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
});

/**
 * How many of `ids` name collections `userId` owns. The item actions compare
 * this against the list's length to refuse a foreign or unknown id before
 * writing, so the user gets a clear message rather than a failed write.
 */
export async function countOwnedCollections(
  userId: string,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0;
  return prisma.collection.count({ where: { userId, id: { in: ids } } });
}

/** Aggregate collection stats for a user's dashboard stat cards. */
export async function getCollectionStats(userId: string): Promise<{
  total: number;
  favorites: number;
}> {
  const [total, favorites] = await Promise.all([
    prisma.collection.count({ where: { userId } }),
    prisma.collection.count({ where: { userId, isFavorite: true } }),
  ]);

  return { total, favorites };
}

/** A newly created collection, as the create action hands it back. */
export interface CreatedCollection {
  id: string;
  name: string;
  description: string | null;
}

/**
 * Create a collection owned by `userId`.
 *
 * There's no `where` clause to carry ownership — the row doesn't exist yet — so
 * the owner is connected from the caller's id, which the action takes from the
 * session rather than from the request.
 */
export async function createCollection(
  userId: string,
  data: { name: string; description: string | null },
): Promise<CreatedCollection> {
  return prisma.collection.create({
    data: {
      name: data.name,
      description: data.description,
      user: { connect: { id: userId } },
    },
    select: { id: true, name: true, description: true },
  });
}
