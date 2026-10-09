import { describe, expect, it } from "vitest";

import {
  CHAOS_PHYSICS,
  clampBody,
  createBody,
  repelDirection,
  stepBody,
  wobble,
  type Body,
  type Bounds,
} from "./chaos-physics";

const BOUNDS: Bounds = { width: 400, height: 300 };
const SIZE = 52;
const FRAME = 1 / 60;

function body(overrides: Partial<Body> = {}): Body {
  return { x: 150, y: 120, vx: 30, vy: 0, size: SIZE, cruise: 30, ...overrides };
}

const center = (b: Body) => ({ x: b.x + b.size / 2, y: b.y + b.size / 2 });
const speed = (b: Body) => Math.hypot(b.vx, b.vy);

function run(b: Body, pointer: { x: number; y: number } | null, seconds: number, bounds = BOUNDS) {
  for (let t = 0; t < seconds; t += FRAME) stepBody(b, bounds, pointer, FRAME);
}

describe("createBody", () => {
  it("starts at the given position moving at its cruise speed", () => {
    const b = createBody(10, 20, SIZE, () => 0.5);
    expect(b).toMatchObject({ x: 10, y: 20, size: SIZE });
    expect(speed(b)).toBeCloseTo(b.cruise);
  });

  it("keeps cruise speed within the configured range", () => {
    expect(createBody(0, 0, SIZE, () => 0).cruise).toBe(CHAOS_PHYSICS.cruiseMin);
    expect(createBody(0, 0, SIZE, () => 0.999999).cruise).toBeCloseTo(CHAOS_PHYSICS.cruiseMax);
  });
});

describe("stepBody — drifting and walls", () => {
  it("drifts at cruise speed when nothing pushes it", () => {
    const b = body();
    stepBody(b, BOUNDS, null, 0.5);
    expect(b.x).toBeCloseTo(150 + 30 * CHAOS_PHYSICS.maxFrame);
    expect(speed(b)).toBeCloseTo(30);
  });

  it("reflects off a wall instead of leaving the field", () => {
    const b = body({ x: BOUNDS.width - SIZE - 0.1, vx: 40 });
    stepBody(b, BOUNDS, null, FRAME);
    expect(b.x).toBe(BOUNDS.width - SIZE);
    expect(b.vx).toBeLessThan(0);
  });

  it("never leaves the field over a long run, even while pushed around", () => {
    const b = body({ vx: 200, vy: -150 });
    const pointer = { x: 200, y: 150 };
    for (let i = 0; i < 2000; i++) {
      stepBody(b, BOUNDS, i % 3 ? pointer : null, FRAME);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x).toBeLessThanOrEqual(BOUNDS.width - SIZE);
      expect(b.y).toBeLessThanOrEqual(BOUNDS.height - SIZE);
    }
  });

  it("clamps a long frame so a backgrounded tab doesn't teleport icons", () => {
    const b = body();
    stepBody(b, BOUNDS, null, 5);
    expect(b.x - 150).toBeCloseTo(30 * CHAOS_PHYSICS.maxFrame);
  });
});

describe("stepBody — cursor repel", () => {
  it("pushes a nearby body away from the cursor", () => {
    const b = body({ vx: 0, vy: 0, cruise: 30 });
    const c = center(b);
    stepBody(b, BOUNDS, { x: c.x - 20, y: c.y }, FRAME);
    expect(b.vx).toBeGreaterThan(30);
  });

  it("ignores a cursor outside the repel radius", () => {
    const b = body();
    const c = center(b);
    stepBody(b, BOUNDS, { x: c.x - CHAOS_PHYSICS.repelRadius - 1, y: c.y }, FRAME);
    expect(b.vx).toBeCloseTo(30);
    expect(b.vy).toBe(0);
  });

  it("caps speed however hard the push", () => {
    const b = body({ vx: 5000, vy: 0 });
    stepBody(b, BOUNDS, null, FRAME);
    expect(speed(b)).toBeLessThanOrEqual(CHAOS_PHYSICS.maxSpeed);
  });

  it("settles back to cruising after a push", () => {
    const b = body({ vx: 400, vy: 0, cruise: 30 });
    run(b, null, 6);
    expect(speed(b)).toBeCloseTo(30, 0);
  });
});

describe("repelDirection", () => {
  it("points straight away from the cursor in open space", () => {
    const [ux, uy] = repelDirection(body(), BOUNDS, 3, 4);
    expect(ux).toBeCloseTo(0.6);
    expect(uy).toBeCloseTo(0.8);
  });

  it("drops the into-wall component and slides along the wall", () => {
    const b = body({ x: 0, y: 40 });
    const [ux, uy] = repelDirection(b, BOUNDS, -1, 0);
    expect(ux).toBe(0);
    // Upper half of the field, so it slides down toward the room.
    expect(uy).toBe(1);
  });

  it("keeps the along-wall component of an angled push", () => {
    const [ux, uy] = repelDirection(body({ x: 0 }), BOUNDS, -0.6, -0.8);
    expect(ux).toBe(0);
    expect(uy).toBe(-1);
  });

  it("escapes a corner along the longer edge", () => {
    const [ux, uy] = repelDirection(body({ x: 0, y: 0 }), BOUNDS, -1, -1);
    expect(ux).toBe(1);
    expect(uy).toBe(0);
  });

  it("returns a unit vector", () => {
    for (const [x, dx, dy] of [[0, -2, 1], [150, 5, -7], [BOUNDS.width - SIZE, 1, 0.1]]) {
      const [ux, uy] = repelDirection(body({ x }), BOUNDS, dx, dy);
      expect(Math.hypot(ux, uy)).toBeCloseTo(1);
    }
  });

  it("gets a body against a wall clear of a cursor parked on it", () => {
    // The mockup's bug: pushed into the wall, the bounce sent the icon back
    // under the cursor and it jittered there instead of escaping.
    const b = body({ x: 0, y: 120, vx: -30, vy: 0 });
    const parked = { x: center(b).x + 1, y: center(b).y };
    run(b, parked, 1);
    const c = center(b);
    expect(Math.hypot(c.x - parked.x, c.y - parked.y)).toBeGreaterThan(CHAOS_PHYSICS.repelRadius * 0.6);
  });
});

describe("clampBody", () => {
  it("pulls a body back inside bounds that shrank", () => {
    const b = body({ x: 380, y: 290 });
    clampBody(b, { width: 300, height: 200 });
    expect(b).toMatchObject({ x: 300 - SIZE, y: 200 - SIZE });
  });

  it("leaves a body that already fits alone", () => {
    const b = body();
    clampBody(b, BOUNDS);
    expect(b).toMatchObject({ x: 150, y: 120 });
  });
});

describe("wobble", () => {
  it("stays within the configured amplitudes", () => {
    for (let ms = 0; ms < 20000; ms += 137) {
      const { rotate, scale } = wobble(1.3, 0.9, ms);
      expect(Math.abs(rotate)).toBeLessThanOrEqual(CHAOS_PHYSICS.rotateAmplitude);
      expect(Math.abs(scale - 1)).toBeLessThanOrEqual(CHAOS_PHYSICS.scaleAmplitude);
    }
  });
});
