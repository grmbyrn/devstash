"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Check, Copy } from "lucide-react";

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
      <div className="flex items-center gap-3 border-b border-border px-3 py-2">
        <WindowDots />
        {label && (
          <span className="min-w-0 flex-1 truncate text-right text-[11px] text-muted-foreground">
            {label}
          </span>
        )}
        <CopyButton value={value} className={cn(!label && "ml-auto")} />
      </div>

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

/**
 * macOS-style traffic lights. Decoration only — they are not buttons, nothing
 * keys off them, and they are hidden from assistive tech.
 */
function WindowDots() {
  return (
    <span aria-hidden className="flex shrink-0 items-center gap-1.5">
      <span className="size-2.5 rounded-full bg-[#ff5f57]" />
      <span className="size-2.5 rounded-full bg-[#febc2e]" />
      <span className="size-2.5 rounded-full bg-[#28c840]" />
    </span>
  );
}

function CopyButton({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  // The timeout is cleared on unmount, so closing the drawer mid-countdown
  // can't call setState on a gone component.
  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard access can be denied or unavailable (insecure origin). The
      // text is selectable either way, so this fails quietly rather than
      // throwing a toast at someone who may not have asked to copy.
    }
  }

  return (
    <button
      // This renders inside the drawer's edit form and the create dialog's
      // form, where a bare <button> would submit them.
      type="button"
      onClick={handleCopy}
      title={copied ? "Copied" : "Copy code"}
      aria-label={copied ? "Copied" : "Copy code"}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&_svg]:size-3.5 [&_svg]:shrink-0",
        className,
      )}
    >
      {copied ? <Check className="text-emerald-400" /> : <Copy />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
