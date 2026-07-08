import { prisma } from "@/lib/prisma";

// No auth yet — all dashboard data belongs to the seeded demo user.
const DEMO_USER_EMAIL = "demo@devstash.io";

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

/** The demo user's pinned items, most recently updated first. */
export async function getPinnedItems(): Promise<ItemWithMeta[]> {
  const rows = await prisma.item.findMany({
    where: { user: { email: DEMO_USER_EMAIL }, isPinned: true },
    orderBy: { updatedAt: "desc" },
    select: itemCardSelect,
  });

  return rows.map(toItemWithMeta);
}

/**
 * The demo user's most recently used items. Falls back to `updatedAt` for items
 * that have never been opened (no `lastUsedAt`), so freshly seeded data surfaces.
 */
export async function getRecentItems(limit = 10): Promise<ItemWithMeta[]> {
  const rows = await prisma.item.findMany({
    where: { user: { email: DEMO_USER_EMAIL } },
    orderBy: [
      { lastUsedAt: { sort: "desc", nulls: "last" } },
      { updatedAt: "desc" },
    ],
    take: limit,
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

/** The system item types for the sidebar type list, in canonical order. */
export async function getSystemItemTypes(): Promise<ItemTypeSummary[]> {
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
}

/** Aggregate item stats for the demo user's dashboard stat cards. */
export async function getItemStats(): Promise<{
  total: number;
  favorites: number;
}> {
  const [total, favorites] = await Promise.all([
    prisma.item.count({ where: { user: { email: DEMO_USER_EMAIL } } }),
    prisma.item.count({
      where: { user: { email: DEMO_USER_EMAIL }, isFavorite: true },
    }),
  ]);

  return { total, favorites };
}
