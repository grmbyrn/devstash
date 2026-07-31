import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ItemCard } from "@/components/dashboard/item-card";
import { ItemTypeIcon } from "@/components/dashboard/item-type-icon";
import { requireUser } from "@/lib/auth/session";
import { getItemsByType, getSystemItemTypes } from "@/lib/db/items";
import { findTypeBySlug, typeLabel } from "@/lib/item-types";

interface ItemsByTypePageProps {
  params: Promise<{ type: string }>;
}

export async function generateMetadata({
  params,
}: ItemsByTypePageProps): Promise<Metadata> {
  const { type: slug } = await params;
  const itemType = findTypeBySlug(await getSystemItemTypes(), slug);

  return {
    title: itemType
      ? `${typeLabel(itemType.name)} · DevStash`
      : "Not found · DevStash",
  };
}

export default async function ItemsByTypePage({
  params,
}: ItemsByTypePageProps) {
  const { type: slug } = await params;

  const user = await requireUser(`/items/${slug}`);

  // The slug is plural ("snippets") while types are stored singular ("snippet").
  const itemType = findTypeBySlug(await getSystemItemTypes(), slug);
  if (!itemType) {
    notFound();
  }

  const items = await getItemsByType(user.id, itemType.id);
  const label = typeLabel(itemType.name);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"
          style={{ color: itemType.color }}
        >
          <ItemTypeIcon name={itemType.icon} className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{label}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? "item" : "items"}
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No {label.toLowerCase()} yet.
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
