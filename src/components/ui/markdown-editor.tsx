"use client";

import * as React from "react";
import dynamic from "next/dynamic";

import { EditorHeader } from "@/components/ui/editor-chrome";
import { cn } from "@/lib/utils";

/**
 * react-markdown and remark-gfm are only needed once someone looks at a
 * preview, so they are fetched on demand rather than riding along in the
 * dashboard's initial payload. `ssr: false` is safe here because every caller
 * (the item drawer, the create dialog) is already a client component.
 *
 * The chrome and the Write tab are plain markup in this module, so typing works
 * — and the copy button works — before the renderer has loaded.
 */
const MarkdownPreview = dynamic(() => import("./markdown-preview"), {
  ssr: false,
  loading: () => (
    <p className="p-3 text-xs text-muted-foreground">Loading preview…</p>
  ),
});

/** Below this the editor looks like a broken input rather than a small one. */
const MIN_HEIGHT = 96;
/** The cap from the spec: past this the editor scrolls instead of growing. */
const MAX_HEIGHT = 400;

type Tab = "write" | "preview";

export interface MarkdownEditorProps {
  value: string;
  /**
   * Omit for display mode. Supplying a handler makes the editor editable —
   * one component serves both, so view and edit can't drift apart visually.
   */
  onChange?: (value: string) => void;
  /** Accessible name for the write field, e.g. the label it sits under. */
  ariaLabel?: string;
  className?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  ariaLabel = "Markdown",
  className,
}: MarkdownEditorProps) {
  const isEditable = Boolean(onChange);
  // Display mode has nothing to switch to, so it opens on — and stays on — the
  // preview. Edit mode opens on Write: someone who clicked the pencil came to
  // type, not to read.
  const [tab, setTab] = React.useState<Tab>(isEditable ? "write" : "preview");

  const activeTab: Tab = isEditable ? tab : "preview";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card",
        className,
      )}
    >
      <EditorHeader label="Markdown" copyValue={value} copyLabel="Copy markdown">
        {isEditable && <TabStrip active={activeTab} onSelect={setTab} />}
      </EditorHeader>

      {activeTab === "write" && onChange ? (
        <WriteTab value={value} onChange={onChange} ariaLabel={ariaLabel} />
      ) : (
        <div
          className="overflow-auto"
          style={{ minHeight: MIN_HEIGHT, maxHeight: MAX_HEIGHT }}
        >
          {value.trim() ? (
            <MarkdownPreview value={value} />
          ) : (
            <p className="p-3 text-xs text-muted-foreground">
              Nothing to preview yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Only rendered in edit mode. A lone, permanently-selected "Preview" tab in
 * display mode would be a control that cannot be operated, so display mode
 * shows the preview with no strip at all.
 */
function TabStrip({
  active,
  onSelect,
}: {
  active: Tab;
  onSelect: (tab: Tab) => void;
}) {
  return (
    <div role="tablist" aria-label="Editor mode" className="ml-auto flex gap-1">
      <TabButton
        tab="write"
        active={active}
        onSelect={onSelect}
        label="Write"
      />
      <TabButton
        tab="preview"
        active={active}
        onSelect={onSelect}
        label="Preview"
      />
    </div>
  );
}

function TabButton({
  tab,
  active,
  onSelect,
  label,
}: {
  tab: Tab;
  active: Tab;
  onSelect: (tab: Tab) => void;
  label: string;
}) {
  const isActive = active === tab;
  return (
    <button
      // These sit inside the drawer's edit form and the create dialog's form,
      // where a bare <button> would submit them.
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => onSelect(tab)}
      className={cn(
        "rounded-md px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        isActive
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

/**
 * A plain textarea that grows with its content up to the shared cap, so short
 * notes don't sit in a tall empty box and long ones scroll instead of pushing
 * the drawer's own scroll position around.
 */
function WriteTab({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Collapse first: scrollHeight only ever reports growth, so without this a
    // textarea that has been tall can never measure itself shorter again.
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={ariaLabel}
      spellCheck
      className="block w-full resize-none bg-transparent p-3 font-mono text-xs leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
      style={{ minHeight: MIN_HEIGHT, maxHeight: MAX_HEIGHT }}
      placeholder="Write markdown…"
    />
  );
}
