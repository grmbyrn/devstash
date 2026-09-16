"use client";

import * as React from "react";

import type { ItemDetail, ItemWithMeta } from "@/lib/db/items";

import { ItemDrawer } from "./item-drawer";

interface ItemDrawerContextValue {
  /** Open the drawer for a card, using the card's data until detail arrives. */
  openItem: (item: ItemWithMeta) => void;
}

const ItemDrawerContext = React.createContext<ItemDrawerContextValue | null>(
  null,
);

export function useItemDrawer() {
  const context = React.useContext(ItemDrawerContext);
  if (!context) {
    throw new Error("useItemDrawer must be used within an ItemDrawerProvider");
  }
  return context;
}

/**
 * Owns the item drawer's open/close state for the whole dashboard shell.
 *
 * Lives in the `(dashboard)` layout so every `ItemCard` — on the dashboard and
 * on `/items/[type]` — can open it without any grid threading state down.
 */
export function ItemDrawerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setOpen] = React.useState(false);
  // The clicked card's data, shown immediately so the header never flashes.
  const [preview, setPreview] = React.useState<ItemWithMeta | null>(null);
  const [detail, setDetail] = React.useState<ItemDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Identifies the in-flight request, so a slow response for a previously
  // clicked card can't overwrite the one the user is actually looking at.
  const requestRef = React.useRef(0);

  const openItem = React.useCallback((item: ItemWithMeta) => {
    const requestId = ++requestRef.current;

    setPreview(item);
    setDetail(null);
    setError(null);
    setOpen(true);

    void (async () => {
      try {
        const response = await fetch(`/api/items/${item.id}`);
        const body = await response.json();

        if (requestId !== requestRef.current) return;

        if (!response.ok || !body.success) {
          setError(body.error ?? "Could not load this item.");
          return;
        }
        setDetail(body.data as ItemDetail);
      } catch {
        if (requestId !== requestRef.current) return;
        setError("Could not load this item.");
      }
    })();
  }, []);

  const handleOpenChange = React.useCallback((open: boolean) => {
    setOpen(open);
    if (!open) {
      // Abandon any in-flight response for the card being closed.
      requestRef.current += 1;
    }
  }, []);

  /**
   * Adopt an edit the drawer just saved. The action returns the refreshed
   * `ItemDetail`, so the open drawer updates without re-fetching; `preview` is
   * kept in step too, since it supplies the header until detail lands and would
   * otherwise show the old title if this item were reopened.
   */
  const handleSaved = React.useCallback((updated: ItemDetail) => {
    setDetail(updated);
    setPreview((current) =>
      current && current.id === updated.id ? { ...current, ...updated } : current,
    );
  }, []);

  const value = React.useMemo(() => ({ openItem }), [openItem]);

  return (
    <ItemDrawerContext.Provider value={value}>
      {children}
      <ItemDrawer
        open={isOpen}
        onOpenChange={handleOpenChange}
        preview={preview}
        detail={detail}
        error={error}
        onSaved={handleSaved}
      />
    </ItemDrawerContext.Provider>
  );
}
