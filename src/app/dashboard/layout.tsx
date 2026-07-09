import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sidebar, SidebarTrigger } from "@/components/dashboard/sidebar";
import { SidebarProvider } from "@/components/dashboard/sidebar-provider";
import {
  getFavoriteCollections,
  getRecentCollections,
} from "@/lib/db/collections";
import { getSystemItemTypes } from "@/lib/db/items";
import { RECENT_COLLECTIONS_LIMIT } from "@/lib/constants";

const SIDEBAR_RECENT_LIMIT = 5;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [itemTypes, favorites, recentCollections] = await Promise.all([
    getSystemItemTypes(),
    getFavoriteCollections(),
    // Fetch the same limit the page uses so the cached query is shared, then
    // take the subset the sidebar renders.
    getRecentCollections(RECENT_COLLECTIONS_LIMIT),
  ]);
  const recents = recentCollections.slice(0, SIDEBAR_RECENT_LIMIT);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar data={{ itemTypes, favorites, recents }} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
            <SidebarTrigger />
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search items, collections, tags…"
                className="h-9 pl-8"
              />
            </div>
            <div className="ml-auto">
              <Button size="sm">
                <Plus />
                New item
              </Button>
            </div>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
