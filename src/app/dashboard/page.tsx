import { FolderHeart, FolderOpen, Library, Star } from "lucide-react";

import { CollectionCard } from "@/components/dashboard/collection-card";
import { ItemCard } from "@/components/dashboard/item-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { collections, items, itemTypes, tags } from "@/lib/mock-data";

const RECENT_COLLECTIONS_LIMIT = 6;
const RECENT_ITEMS_LIMIT = 10;

const typeById = new Map(itemTypes.map((t) => [t.id, t]));
const tagById = new Map(tags.map((t) => [t.id, t]));

function accentTypeForCollection(collectionId: string) {
  const collection = collections.find((c) => c.id === collectionId);
  if (!collection) return undefined;

  const counts = new Map<string, number>();
  for (const itemId of collection.itemIds) {
    const item = items.find((i) => i.id === itemId);
    if (!item) continue;
    counts.set(item.itemTypeId, (counts.get(item.itemTypeId) ?? 0) + 1);
  }
  const topTypeId =
    [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    collection.defaultTypeId;

  return topTypeId ? typeById.get(topTypeId) : undefined;
}

export default function DashboardPage() {
  const stats = {
    items: items.length,
    collections: collections.length,
    favoriteItems: items.filter((i) => i.isFavorite).length,
    favoriteCollections: collections.filter((c) => c.isFavorite).length,
  };

  const recentCollections = [...collections]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, RECENT_COLLECTIONS_LIMIT);

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
            <CollectionCard
              key={c.id}
              collection={c}
              accentType={accentTypeForCollection(c.id)}
            />
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
