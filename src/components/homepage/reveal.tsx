"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

// Literal class names so Tailwind can see them; index = position in a row.
const DELAYS = ["", "[animation-delay:80ms]", "[animation-delay:160ms]"] as const;

/**
 * Fades its (server-rendered) children in the first time they scroll into
 * view. The pre-reveal hiding lives in globals.css, gated on scripting and
 * motion preference, so content is never stuck hidden without JavaScript.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: 0 | 1 | 2;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal
      data-visible={visible || undefined}
      className={cn("data-visible:motion-safe:animate-reveal", DELAYS[delay], className)}
    >
      {children}
    </div>
  );
}
