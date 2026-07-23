import { prisma } from "@/lib/prisma";
import { getSystemItemTypes, type ItemTypeSummary } from "@/lib/db/items";

/** A system item type plus how many of the user's items use it. */
export interface TypeBreakdown extends ItemTypeSummary {
  count: number;
}

/** Everything the profile page's stats section renders, scoped to one user. */
export interface ProfileStats {
  totalItems: number;
  totalCollections: number;
  /** Every system type in canonical order, each with the user's item count. */
  breakdown: TypeBreakdown[];
}

/**
 * Aggregate stats for the signed-in user. Unlike the dashboard helpers (which are
 * still scoped to the seeded demo user), these key off the real `userId` from the
 * session. Counts items per system type via a single `groupBy`, then maps onto the
 * ordered type list so every type shows — including ones with a zero count.
 */
export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const [totalItems, totalCollections, grouped, types] = await Promise.all([
    prisma.item.count({ where: { userId } }),
    prisma.collection.count({ where: { userId } }),
    prisma.item.groupBy({
      by: ["itemTypeId"],
      where: { userId },
      _count: { _all: true },
    }),
    getSystemItemTypes(),
  ]);

  const countByType = new Map(
    grouped.map((g) => [g.itemTypeId, g._count._all]),
  );

  const breakdown: TypeBreakdown[] = types.map((type) => ({
    ...type,
    count: countByType.get(type.id) ?? 0,
  }));

  return { totalItems, totalCollections, breakdown };
}
