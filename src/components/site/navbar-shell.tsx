"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

const isScrolled = () => window.scrollY > 8;
const isScrolledOnServer = () => false;

/**
 * The fixed site header. Translucent at the top of the page and more
 * opaque once scrolled; the nav inside it is server-rendered children.
 */
export function NavbarShell({ children }: { children: React.ReactNode }) {
  const scrolled = useSyncExternalStore(subscribe, isScrolled, isScrolledOnServer);

  return (
    <header
      data-scrolled={scrolled || undefined}
      className="fixed inset-x-0 top-0 z-50 h-16 border-b border-transparent bg-background/35 backdrop-blur-md transition-colors duration-300 data-scrolled:border-border data-scrolled:bg-background/90"
    >
      {children}
    </header>
  );
}
