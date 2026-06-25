import { prisma } from "@/lib/prisma";

// No auth yet — all dashboard data belongs to the seeded demo user.
const DEMO_USER_EMAIL = "demo@devstash.io";

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
 * Fetch the demo user's most recently updated collections, each enriched with
 * its item count and the item types it contains (ranked by frequency).
 */
export async function getRecentCollections(
  limit = 6,
): Promise<CollectionWithMeta[]> {
  const collections = await prisma.collection.findMany({
    where: { user: { email: DEMO_USER_EMAIL } },
    orderBy: { updatedAt: "desc" },
    take: limit,
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

/** Aggregate collection stats for the demo user's dashboard stat cards. */
export async function getCollectionStats(): Promise<{
  total: number;
  favorites: number;
}> {
  const [total, favorites] = await Promise.all([
    prisma.collection.count({ where: { user: { email: DEMO_USER_EMAIL } } }),
    prisma.collection.count({
      where: { user: { email: DEMO_USER_EMAIL }, isFavorite: true },
    }),
  ]);

  return { total, favorites };
}
