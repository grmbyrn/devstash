"use client";

import dynamic from "next/dynamic";

import { EditorHeader } from "@/components/ui/editor-chrome";
import { languageLabel, normalizeLanguage } from "@/lib/code-language";
import { cn } from "@/lib/utils";

/**
 * Monaco is multi-megabyte and browser-only, so it is never part of the
 * dashboard's initial payload: `ssr: false` keeps it off the server render and
 * `next/dynamic` fetches it only once a drawer or the create dialog actually
 * mounts one of these.
 *
 * The chrome below — dots, language, copy button — is plain markup in this
 * module, so it paints immediately and the copy button works before the editor
 * has finished loading.
 */
const CodeEditorMonaco = dynamic(() => import("./code-editor-monaco"), {
  ssr: false,
});

/** Below this the editor looks like a broken input rather than a small one. */
const MIN_HEIGHT = 96;
/** The cap from the spec: past this the editor scrolls instead of growing. */
const MAX_HEIGHT = 400;

const LINE_HEIGHT = 20;
const VERTICAL_PADDING = 24;

/** How tall the editor will land, so the placeholder doesn't cause a jump. */
function estimateHeight(value: string): number {
  const lines = value ? value.split("\n").length : 1;
  return Math.min(
    Math.max(lines * LINE_HEIGHT + VERTICAL_PADDING, MIN_HEIGHT),
    MAX_HEIGHT,
  );
}

export interface CodeEditorProps {
  value: string;
  /**
   * Omit for display mode. Supplying a handler makes the editor editable —
   * one component serves both, so view and edit can't drift apart visually.
   */
  onChange?: (value: string) => void;
  /** Free text from `Item.language`; normalized before it reaches Monaco. */
  language?: string | null;
  /** Accessible name for the editor, e.g. the field label it sits under. */
  ariaLabel?: string;
  className?: string;
}

export function CodeEditor({
  value,
  onChange,
  language,
  ariaLabel = "Code",
  className,
}: CodeEditorProps) {
  const monacoLanguage = normalizeLanguage(language);
  const label = languageLabel(language);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card",
        className,
      )}
    >
      <EditorHeader label={label} copyValue={value} copyLabel="Copy code" />

      {/* Reserves the height the editor is about to take, so the panel doesn't
          snap taller the moment Monaco finishes loading. A runtime-measured
          value can't be a Tailwind class, the same exception the item type
          colors already make. */}
      <div style={{ minHeight: estimateHeight(value) }}>
        <CodeEditorMonaco
          value={value}
          onChange={onChange}
          language={monacoLanguage}
          ariaLabel={ariaLabel}
          minHeight={MIN_HEIGHT}
          maxHeight={MAX_HEIGHT}
          // Remount when the mode flips, so a readonly instance is never reused
          // as an editable one with a stale `readOnly` baked into it.
          key={onChange ? "edit" : "view"}
        />
      </div>
    </div>
  );
}
