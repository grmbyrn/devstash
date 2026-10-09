"use client";

import { useEffect, useRef } from "react";

import {
  clampBody,
  createBody,
  stepBody,
  wobble,
  type Body,
  type Bounds,
  type Point,
} from "@/lib/chaos-physics";
import { cn } from "@/lib/utils";

import { CHAOS_ICONS } from "./content";

interface Sprite {
  el: HTMLElement;
  body: Body;
  phase: number;
  rate: number;
  /** The server-rendered position, restored on cleanup. */
  initial: { left: string; top: string };
}

function render({ el, body, phase, rate }: Sprite, ms: number) {
  const { rotate, scale } = wobble(phase, rate, ms);
  el.style.transform = `translate3d(${body.x.toFixed(1)}px, ${body.y.toFixed(1)}px, 0) rotate(${rotate.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
}

/**
 * Hand the server-rendered percentage positions over to transforms and run
 * the physics loop while the field is on screen. Returns a cleanup that puts
 * the icons back where the server drew them, so a re-run (Strict Mode, Fast
 * Refresh) starts from the same layout.
 */
function startChaos(field: HTMLElement): () => void {
  const sprites: Sprite[] = Array.from(
    field.querySelectorAll<HTMLElement>("[data-chaos-icon]"),
    (el) => {
      const sprite = {
        el,
        body: createBody(el.offsetLeft, el.offsetTop, el.offsetWidth),
        phase: Math.random() * Math.PI * 2,
        rate: 0.6 + Math.random() * 0.6,
        initial: { left: el.style.left, top: el.style.top },
      };
      el.style.left = "0px";
      el.style.top = "0px";
      render(sprite, 0);
      return sprite;
    },
  );

  const bounds: Bounds = { width: field.clientWidth, height: field.clientHeight };
  let pointer: Point | null = null;
  let frameId = 0;
  let lastTime = 0;

  const frame = (time: number) => {
    const dt = lastTime ? (time - lastTime) / 1000 : 0;
    lastTime = time;
    for (const sprite of sprites) {
      stepBody(sprite.body, bounds, pointer, dt);
      render(sprite, time);
    }
    frameId = requestAnimationFrame(frame);
  };

  const trackPointer = (event: PointerEvent) => {
    const rect = field.getBoundingClientRect();
    pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const clearPointer = () => {
    pointer = null;
  };
  field.addEventListener("pointermove", trackPointer);
  field.addEventListener("pointerdown", trackPointer);
  field.addEventListener("pointerleave", clearPointer);

  const resizeObserver = new ResizeObserver(() => {
    bounds.width = field.clientWidth;
    bounds.height = field.clientHeight;
    for (const sprite of sprites) clampBody(sprite.body, bounds);
  });
  resizeObserver.observe(field);

  // Only animate while the field is on screen.
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    cancelAnimationFrame(frameId);
    frameId = 0;
    if (entry.isIntersecting) {
      lastTime = 0;
      frameId = requestAnimationFrame(frame);
    }
  });
  visibilityObserver.observe(field);

  return () => {
    cancelAnimationFrame(frameId);
    visibilityObserver.disconnect();
    resizeObserver.disconnect();
    field.removeEventListener("pointermove", trackPointer);
    field.removeEventListener("pointerdown", trackPointer);
    field.removeEventListener("pointerleave", clearPointer);
    for (const { el, initial } of sprites) {
      el.style.left = initial.left;
      el.style.top = initial.top;
      el.style.transform = "";
    }
  };
}

/**
 * The "your knowledge today" field: icons drift, bounce off the walls and
 * flee the cursor. Under reduced motion they stay where the server drew them.
 */
export function ChaosField({ className }: { className?: string }) {
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    return startChaos(field);
  }, []);

  return (
    <div
      ref={fieldRef}
      className={cn(
        "relative h-70 overflow-hidden rounded-lg border border-dashed border-white/15 bg-background bg-[radial-gradient(circle_at_1px_1px,rgb(255_255_255/0.07)_1px,transparent_0)] bg-size-[18px_18px] md:h-80",
        className,
      )}
    >
      {CHAOS_ICONS.map(({ label, Icon, className: tint, x, y }) => (
        <div
          key={label}
          data-chaos-icon
          role="img"
          aria-label={label}
          title={label}
          className="absolute grid size-13 place-items-center rounded-xl border border-white/15 bg-secondary shadow-lg shadow-black/40 will-change-transform"
          style={{ left: `${x}%`, top: `${y}%` }}
        >
          <Icon className={cn("size-7", tint)} />
        </div>
      ))}
    </div>
  );
}
