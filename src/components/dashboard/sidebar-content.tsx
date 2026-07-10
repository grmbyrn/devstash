"use client";

import Link from "next/link";
import { Clock, Star } from "lucide-react";

import type {
  CollectionWithMeta,
  SidebarCollection,
} from "@/lib/db/collections";
import type { ItemTypeSummary } from "@/lib/db/items";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { ItemTypeIcon } from "./item-type-icon";
import { useSidebar } from "./sidebar-provider";
import { UserMenu, type SidebarUser } from "./user-menu";

export interface SidebarData {
  itemTypes: ItemTypeSummary[];
  favorites: SidebarCollection[];
  recents: CollectionWithMeta[];
  user: SidebarUser;
}

/** Item types gated behind Pro in production. */
const PRO_TYPES = new Set(["file", "image"]);

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function SidebarContent({
  data,
  compact = false,
}: {
  data: SidebarData;
  compact?: boolean;
}) {
  const { setMobileOpen } = useSidebar();
  const onNavigate = () => setMobileOpen(false);

  const { itemTypes, favorites, recents, user } = data;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground text-xs font-semibold">
          DS
        </div>
        {!compact && (
          <span className="text-sm font-semibold tracking-tight">
            DevStash
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <Section title="Types" compact={compact}>
          {itemTypes.map((type) => (
            <NavItem
              key={type.id}
              href={`/items/${type.name}s`}
              label={`${titleCase(type.name)}s`}
              icon={
                <ItemTypeIcon name={type.icon} className="size-4 shrink-0" />
              }
              color={type.color}
              trailing={
                PRO_TYPES.has(type.name) ? (
                  <Badge
                    variant="secondary"
                    className="h-4 rounded px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Pro
                  </Badge>
                ) : undefined
              }
              compact={compact}
              onClick={onNavigate}
            />
          ))}
        </Section>

        {favorites.length > 0 && (
          <Section title="Favorites" compact={compact}>
            {favorites.map((c) => (
              <NavItem
                key={c.id}
                href={`/collections/${c.id}`}
                label={c.name}
                icon={
                  <Star className="size-4 shrink-0 fill-yellow-400 text-yellow-400" />
                }
                compact={compact}
                onClick={onNavigate}
              />
            ))}
          </Section>
        )}

        <Section title="Recent" compact={compact}>
          {recents.map((c) => (
            <NavItem
              key={c.id}
              href={`/collections/${c.id}`}
              label={c.name}
              icon={
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      c.accentType?.color ?? "var(--color-muted-foreground)",
                  }}
                />
              }
              compact={compact}
              onClick={onNavigate}
            />
          ))}
          <NavItem
            href="/collections"
            label="View all collections"
            icon={<Clock className="size-4 shrink-0 text-muted-foreground" />}
            muted
            compact={compact}
            onClick={onNavigate}
          />
        </Section>
      </nav>

      <UserMenu user={user} compact={compact} />
    </div>
  );
}

function Section({
  title,
  compact,
  children,
}: {
  title: string;
  compact: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      {!compact && (
        <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
      )}
      {compact && <div className="mx-2 mb-1 h-px bg-border" />}
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon,
  color,
  trailing,
  muted,
  compact,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  color?: string;
  trailing?: React.ReactNode;
  muted?: boolean;
  compact: boolean;
  onClick?: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        title={compact ? label : undefined}
        onClick={onClick}
        className={cn(
          "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground",
          muted && "text-muted-foreground",
          compact && "justify-center px-0",
        )}
      >
        <span
          className="grid size-5 place-items-center"
          style={color ? { color } : undefined}
        >
          {icon}
        </span>
        {!compact && <span className="truncate">{label}</span>}
        {!compact && trailing && <span className="ml-auto">{trailing}</span>}
      </Link>
    </li>
  );
}

