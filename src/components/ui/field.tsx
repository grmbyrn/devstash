import * as React from "react";

/**
 * A labelled form row: label above control, with an optional parenthesised
 * hint. Shared by the item drawer's edit form and the create dialog so the two
 * forms can't drift apart visually.
 *
 * `htmlFor` is optional because not every control has an element to point at:
 * `CodeEditor` wraps Monaco, which owns its own textarea, so it carries its
 * accessible name via `ariaLabel` instead. Those rows render the caption as a
 * plain span — a `<label for>` aimed at nothing would be worse than none.
 */
function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const caption = (
    <>
      {label}
      {hint && <span className="ml-1.5 font-normal opacity-70">({hint})</span>}
    </>
  );
  const className = "text-xs font-medium text-muted-foreground";

  return (
    <div className="flex flex-col gap-1.5">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={className}>
          {caption}
        </label>
      ) : (
        <span className={className}>{caption}</span>
      )}
      {children}
    </div>
  );
}

export { Field };
