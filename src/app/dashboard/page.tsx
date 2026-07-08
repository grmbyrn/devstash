import { FolderHeart, FolderOpen, Library, Star } from "lucide-react";

import { CollectionCard } from "@/components/dashboard/collection-card";
import { ItemCard } from "@/components/dashboard/item-card";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  getCollectionStats,
  getRecentCollections,
} from "@/lib/db/collections";
import { getItemStats, getPinnedItems, getRecentItems } from "@/lib/db/items";

const RECENT_COLLECTIONS_LIMIT = 6;
const RECENT_ITEMS_LIMIT = 10;

export default async function DashboardPage() {
  const [recentCollections, collectionStats, itemStats, pinnedItems, recentItems] =
    await Promise.all([
      getRecentCollections(RECENT_COLLECTIONS_LIMIT),
      getCollectionStats(),
      getItemStats(),
      getPinnedItems(),
      getRecentItems(RECENT_ITEMS_LIMIT),
    ]);

  const stats = {
    items: itemStats.total,
    collections: collectionStats.total,
    favoriteItems: itemStats.favorites,
    favoriteCollections: collectionStats.favorites,
  };

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
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Recent items">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recentItems.map((item) => (
            <ItemCard key={item.id} item={item} />
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
