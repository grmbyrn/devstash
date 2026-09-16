"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toast host. Mounted once in the dashboard layout; anything below it calls
 * `toast()` from `sonner` directly.
 *
 * Colors are wired to the app's own theme tokens rather than sonner's defaults,
 * so toasts match the surrounding surfaces. `theme="dark"` is fixed because the
 * root layout hardcodes the `dark` class — revisit when light mode ships.
 */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position="bottom-right"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--error-bg": "var(--popover)",
          "--error-text": "var(--destructive)",
          "--error-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}
