/**
 * Motion for the homepage's floating "scattered knowledge" icons.
 *
 * Pure functions with no DOM access, so the behaviour — drifting, bouncing
 * off walls, fleeing the cursor without getting pinned — is unit-testable.
 * `ChaosField` owns the requestAnimationFrame loop and writes the transforms.
 */

export const CHAOS_PHYSICS = {
  cruiseMin: 28, // px/s
  cruiseMax: 55, // px/s
  maxSpeed: 520, // px/s
  repelRadius: 110, // px
  repelForce: 2600, // px/s² at the cursor, fading to 0 at the radius
  speedEase: 1.6, // how quickly a pushed icon settles back to cruising
  rotateAmplitude: 12, // degrees
  scaleAmplitude: 0.06,
  maxFrame: 0.05, // s — clamp so a backgrounded tab doesn't teleport icons
} as const;

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  /** The speed this body drifts at when nothing is pushing it. */
  cruise: number;
}

export interface Bounds {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** A body at (x, y) heading in a random direction at a random cruise speed. */
export function createBody(x: number, y: number, size: number, random = Math.random): Body {
  const angle = random() * Math.PI * 2;
  const cruise =
    CHAOS_PHYSICS.cruiseMin + random() * (CHAOS_PHYSICS.cruiseMax - CHAOS_PHYSICS.cruiseMin);
  return { x, y, size, cruise, vx: Math.cos(angle) * cruise, vy: Math.sin(angle) * cruise };
}

/**
 * Unit vector pushing a body away from the cursor, given the offset (dx, dy)
 * from cursor to body center.
 *
 * Against a wall, the component aimed into it is dropped so the body slides
 * along the wall instead of being pinned under the cursor; a square-on push
 * slides it toward whichever side has more room. Cornered, it escapes along
 * the longer edge.
 */
export function repelDirection(body: Body, bounds: Bounds, dx: number, dy: number): [number, number] {
  const distance = Math.hypot(dx, dy) || 1;
  let ux = dx / distance;
  let uy = dy / distance;
  const maxX = bounds.width - body.size;
  const maxY = bounds.height - body.size;
  const blockedX = (body.x <= 0.5 && ux < 0) || (body.x >= maxX - 0.5 && ux > 0);
  const blockedY = (body.y <= 0.5 && uy < 0) || (body.y >= maxY - 0.5 && uy > 0);
  const towardRoom = (position: number, max: number) => (position < max / 2 ? 1 : -1);

  if (blockedX) {
    ux = 0;
    if (!blockedY && Math.abs(uy) < 0.3) uy = towardRoom(body.y, maxY);
  }
  if (blockedY) {
    uy = 0;
    if (!blockedX && Math.abs(ux) < 0.3) ux = towardRoom(body.x, maxX);
  }
  if (blockedX && blockedY) {
    if (bounds.width >= bounds.height) ux = towardRoom(body.x, maxX);
    else uy = towardRoom(body.y, maxY);
  }

  const length = Math.hypot(ux, uy) || 1;
  return [ux / length, uy / length];
}

/** Push a body away from the cursor if it's within the repel radius. */
function applyRepel(body: Body, bounds: Bounds, pointer: Point, dt: number): void {
  const dx = body.x + body.size / 2 - pointer.x;
  const dy = body.y + body.size / 2 - pointer.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0 || distance >= CHAOS_PHYSICS.repelRadius) return;

  const push = (1 - distance / CHAOS_PHYSICS.repelRadius) * CHAOS_PHYSICS.repelForce * dt;
  const [ux, uy] = repelDirection(body, bounds, dx, dy);
  body.vx += ux * push;
  body.vy += uy * push;
}

/** Ease speed back toward cruising so a push fades out, capped at maxSpeed. */
function settleSpeed(body: Body, dt: number): void {
  const speed = Math.hypot(body.vx, body.vy) || 1;
  const target = speed + (body.cruise - speed) * Math.min(1, dt * CHAOS_PHYSICS.speedEase);
  const scale = Math.min(target, CHAOS_PHYSICS.maxSpeed) / speed;
  body.vx *= scale;
  body.vy *= scale;
}

/** Move, then reflect off any wall the body crossed, keeping it in bounds. */
function moveAndBounce(body: Body, bounds: Bounds, dt: number): void {
  body.x += body.vx * dt;
  body.y += body.vy * dt;

  const maxX = Math.max(0, bounds.width - body.size);
  const maxY = Math.max(0, bounds.height - body.size);
  if (body.x < 0) {
    body.x = 0;
    body.vx = Math.abs(body.vx);
  } else if (body.x > maxX) {
    body.x = maxX;
    body.vx = -Math.abs(body.vx);
  }
  if (body.y < 0) {
    body.y = 0;
    body.vy = Math.abs(body.vy);
  } else if (body.y > maxY) {
    body.y = maxY;
    body.vy = -Math.abs(body.vy);
  }
}

/** Advance one body by `dt` seconds. Mutates in place — it runs every frame. */
export function stepBody(body: Body, bounds: Bounds, pointer: Point | null, dt: number): void {
  const step = Math.min(dt, CHAOS_PHYSICS.maxFrame);
  if (pointer) applyRepel(body, bounds, pointer, step);
  settleSpeed(body, step);
  moveAndBounce(body, bounds, step);
}

/** Pull a body back inside bounds that shrank (e.g. the field resized). */
export function clampBody(body: Body, bounds: Bounds): void {
  body.x = Math.min(body.x, Math.max(0, bounds.width - body.size));
  body.y = Math.min(body.y, Math.max(0, bounds.height - body.size));
}

/** The gentle rotation and scale pulse for a body at time `ms`. */
export function wobble(phase: number, rate: number, ms: number): { rotate: number; scale: number } {
  const t = ms / 1000;
  return {
    rotate: Math.sin(t * rate + phase) * CHAOS_PHYSICS.rotateAmplitude,
    scale: 1 + Math.sin(t * rate * 1.7 + phase) * CHAOS_PHYSICS.scaleAmplitude,
  };
}
