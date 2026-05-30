import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
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
      <div className="flex flex-1">
        <aside className="w-60 border-r border-border bg-card/40 p-4">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Sidebar
          </h2>
        </aside>
        <main className="flex-1 p-6">
          <h2 className="text-sm font-semibold text-muted-foreground">Main</h2>
          {children}
        </main>
      </div>
    </div>
  );
}
