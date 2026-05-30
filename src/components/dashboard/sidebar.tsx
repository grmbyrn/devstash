"use client";

import { PanelLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { SidebarContent } from "./sidebar-content";
import { useSidebar } from "./sidebar-provider";

export function Sidebar() {
  const { isCollapsed, isMobileOpen, setMobileOpen } = useSidebar();

  return (
    <>
      <aside
        className={cn(
          "hidden shrink-0 border-r border-border bg-card/40 transition-[width] duration-200 ease-in-out lg:block",
          isCollapsed ? "w-16" : "w-60",
        )}
      >
        <SidebarContent compact={isCollapsed} />
      </aside>

      <Sheet open={isMobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 lg:hidden">
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  );
}

export function SidebarTrigger() {
  const { toggleCollapsed, setMobileOpen } = useSidebar();

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:inline-flex"
        onClick={toggleCollapsed}
        aria-label="Toggle sidebar"
      >
        <PanelLeft />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <PanelLeft />
      </Button>
    </>
  );
}
