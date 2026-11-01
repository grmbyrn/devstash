import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { ItemCard } from "@/components/dashboard/item-card";
import { auth } from "@/auth";
import { requireUser } from "@/lib/auth/session";
import { getCollectionById } from "@/lib/db/collections";
import { getItemsByCollection } from "@/lib/db/items";

interface CollectionPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: CollectionPageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await auth();
  const collection = session?.user?.id
    ? await getCollectionById(session.user.id, id)
    : null;

  return {
    title: collection
      ? `${collection.name} · DevStash`
      : "Not found · DevStash",
  };
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { id } = await params;

  const user = await requireUser(`/collections/${id}`);

  // Both queries are scoped to the user, so running them together is safe: a
  // foreign collection id yields no collection and no items.
  const [collection, items] = await Promise.all([
    getCollectionById(user.id, id),
    getItemsByCollection(user.id, id),
  ]);
  if (!collection) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/collections"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        All collections
      </Link>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {collection.name}
        </h1>
        {collection.description && (
          <p className="mt-1 text-sm text-muted-foreground">
            {collection.description}
          </p>
        )}
        <p className="mt-0.5 text-sm text-muted-foreground">
          {items.length} {items.length === 1 ? "item" : "items"}
        </p>
      </header>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No items in this collection yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
