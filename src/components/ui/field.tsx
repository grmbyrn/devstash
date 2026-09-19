import * as React from "react";

/**
 * A labelled form row: label above control, with an optional parenthesised
 * hint. Shared by the item drawer's edit form and the create dialog so the two
 * forms can't drift apart visually.
 */
function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium text-muted-foreground"
      >
        {label}
        {hint && <span className="ml-1.5 font-normal opacity-70">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

export { Field };
