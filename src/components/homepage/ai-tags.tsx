"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

const FIRST_TAG_DELAY = 800;
const TAG_INTERVAL = 220;

/**
 * The "AI Generated Tags" demo: tags appear one by one once the editor
 * mockup scrolls into view, or all at once under reduced motion.
 */
export function AiTags({ tags }: { tags: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const timers: number[] = [];
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          setShown(tags.length);
          return;
        }
        tags.forEach((_, i) => {
          timers.push(window.setTimeout(() => setShown(i + 1), FIRST_TAG_DELAY + i * TAG_INTERVAL));
        });
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [tags]);

  const done = shown === tags.length;

  return (
    <div ref={ref} className="border-t border-border bg-card px-5 pt-4 pb-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-brand">
        <Sparkles className="size-3.5" aria-hidden />
        AI Generated Tags
        <span
          aria-live="polite"
          className={cn("ml-auto font-medium", done ? "text-emerald-500" : "text-muted-foreground")}
        >
          {done ? `${tags.length} tags suggested` : "Analyzing…"}
        </span>
      </p>
      <ul className="mt-3 flex min-h-7 flex-wrap gap-2">
        {tags.map((tag, i) => (
          <li
            key={tag}
            data-ai-tag
            data-shown={i < shown || undefined}
            className="rounded-full border border-brand/35 bg-brand/12 px-3 py-0.5 font-mono text-xs transition-opacity duration-300"
          >
            {tag}
          </li>
        ))}
      </ul>
    </div>
  );
}
