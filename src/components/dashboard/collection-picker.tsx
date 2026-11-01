"use client";

import { Check } from "lucide-react";

import type { CollectionOption } from "@/lib/db/collections";
import { cn } from "@/lib/utils";

/**
 * Pick any number of collections, as a row of toggle chips. Shared by the
 * "New item" dialog and the drawer's edit form so the two can't drift.
 *
 * Chips rather than a dropdown because there is no popover/select primitive in
 * the project and a handful of collections fits on screen; each chip is an
 * `aria-pressed` button inside a labelled fieldset, so it reads as a group of
 * toggles to assistive tech.
 */
export function CollectionPicker({
  collections,
  value,
  onChange,
  disabled,
}: {
  collections: CollectionOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  function toggle(id: string) {
    onChange(
      value.includes(id) ? value.filter((v) => v !== id) : [...value, id],
    );
  }

  return (
    <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
      <legend className="mb-1.5 text-xs font-medium text-muted-foreground">
        Collections
      </legend>
      {collections.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No collections yet — create one from the header.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {collections.map((collection) => {
            const isSelected = value.includes(collection.id);
            return (
              <button
                key={collection.id}
                type="button"
                onClick={() => toggle(collection.id)}
                aria-pressed={isSelected}
                className={cn(
                  "inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50",
                  isSelected
                    ? "border-primary bg-accent text-foreground"
                    : "border-border text-muted-foreground hover:bg-accent/50",
                )}
              >
                {isSelected && <Check className="size-3 shrink-0" />}
                <span className="truncate">{collection.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
