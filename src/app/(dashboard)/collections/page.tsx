import type { Metadata } from "next";

import { CollectionCard } from "@/components/dashboard/collection-card";
import { requireUser } from "@/lib/auth/session";
import { getAllCollections } from "@/lib/db/collections";

export const metadata: Metadata = {
  title: "Collections · DevStash",
};

export default async function CollectionsPage() {
  const user = await requireUser("/collections");
  const collections = await getAllCollections(user.id);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Collections</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {collections.length}{" "}
          {collections.length === 1 ? "collection" : "collections"}
        </p>
      </header>

      {collections.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No collections yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {collections.map((c) => (
            <CollectionCard key={c.id} collection={c} />
          ))}
        </div>
      )}
    </div>
  );
}
