"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The window chrome shared by `CodeEditor` and `MarkdownEditor`: macOS traffic
 * lights on the left, an optional label, and a copy button.
 *
 * This lived inside `code-editor.tsx` until the markdown editor needed exactly
 * the same header. Extracting it rather than copying means the two editors are
 * identical by construction — when a snippet and a note sit in the same drawer,
 * their headers cannot drift apart.
 */
export function EditorHeader({
  label,
  copyValue,
  copyLabel = "Copy",
  children,
}: {
  label?: string | null;
  /** Raw text the copy button puts on the clipboard. */
  copyValue: string;
  /** Tooltip/aria verb, e.g. "Copy code" or "Copy markdown". */
  copyLabel?: string;
  /** Extra controls rendered between the label and the copy button. */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-3 py-2">
      <WindowDots />
      {label && (
        <span className="min-w-0 flex-1 truncate text-right text-[11px] text-muted-foreground">
          {label}
        </span>
      )}
      {children}
      <CopyButton
        value={copyValue}
        label={copyLabel}
        className={cn(!label && !children && "ml-auto")}
      />
    </div>
  );
}

/**
 * macOS-style traffic lights. Decoration only — they are not buttons, nothing
 * keys off them, and they are hidden from assistive tech.
 */
export function WindowDots() {
  return (
    <span aria-hidden className="flex shrink-0 items-center gap-1.5">
      <span className="size-2.5 rounded-full bg-[#ff5f57]" />
      <span className="size-2.5 rounded-full bg-[#febc2e]" />
      <span className="size-2.5 rounded-full bg-[#28c840]" />
    </span>
  );
}

export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string;
  label?: string;
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
      title={copied ? "Copied" : label}
      aria-label={copied ? "Copied" : label}
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
