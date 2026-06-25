import { FolderHeart, FolderOpen, Library, Star } from "lucide-react";

import { CollectionCard } from "@/components/dashboard/collection-card";
import { ItemCard } from "@/components/dashboard/item-card";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  getCollectionStats,
  getRecentCollections,
} from "@/lib/db/collections";
import { items, itemTypes, tags } from "@/lib/mock-data";

const RECENT_COLLECTIONS_LIMIT = 6;
const RECENT_ITEMS_LIMIT = 10;

const typeById = new Map(itemTypes.map((t) => [t.id, t]));
const tagById = new Map(tags.map((t) => [t.id, t]));

export default async function DashboardPage() {
  const [recentCollections, collectionStats] = await Promise.all([
    getRecentCollections(RECENT_COLLECTIONS_LIMIT),
    getCollectionStats(),
  ]);

  const stats = {
    items: items.length,
    collections: collectionStats.total,
    favoriteItems: items.filter((i) => i.isFavorite).length,
    favoriteCollections: collectionStats.favorites,
  };

  const pinnedItems = items.filter((i) => i.isPinned);

  const recentItems = [...items]
    .filter((i) => i.lastUsedAt)
    .sort(
      (a, b) =>
        new Date(b.lastUsedAt ?? 0).getTime() -
        new Date(a.lastUsedAt ?? 0).getTime(),
    )
    .slice(0, RECENT_ITEMS_LIMIT);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your developer knowledge hub
        </p>
      </header>

      <section
        aria-label="Stats"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <StatCard label="Items" value={stats.items} icon={Library} />
        <StatCard
          label="Collections"
          value={stats.collections}
          icon={FolderOpen}
        />
        <StatCard
          label="Favorite items"
          value={stats.favoriteItems}
          icon={Star}
        />
        <StatCard
          label="Favorite collections"
          value={stats.favoriteCollections}
          icon={FolderHeart}
        />
      </section>

      <Section title="Recent collections">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {recentCollections.map((c) => (
            <CollectionCard key={c.id} collection={c} />
          ))}
        </div>
      </Section>

      {pinnedItems.length > 0 && (
        <Section title="Pinned items">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pinnedItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                type={typeById.get(item.itemTypeId)}
                tags={item.tagIds
                  .map((id) => tagById.get(id))
                  .filter((t): t is NonNullable<typeof t> => Boolean(t))}
              />
            ))}
          </div>
        </Section>
      )}

      <Section title="Recent items">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recentItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              type={typeById.get(item.itemTypeId)}
              tags={item.tagIds
                .map((id) => tagById.get(id))
                .filter((t): t is NonNullable<typeof t> => Boolean(t))}
            />
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}
