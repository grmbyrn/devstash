import { describe, expect, it } from "vitest";

import { formatFileSize, relativeTime } from "./format";

// Fixed reference point so these never depend on the wall clock.
const NOW = new Date("2026-08-01T12:00:00.000Z");

function ago(ms: number) {
  return new Date(NOW.getTime() - ms).toISOString();
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("relativeTime", () => {
  it("reads 'just now' under a minute", () => {
    expect(relativeTime(ago(5 * SECOND), NOW)).toBe("just now");
    expect(relativeTime(NOW.toISOString(), NOW)).toBe("just now");
  });

  it("formats the spec's example — 4 days ago", () => {
    expect(relativeTime(ago(4 * DAY), NOW)).toBe("4 days ago");
  });

  it("picks the largest unit that fits", () => {
    expect(relativeTime(ago(3 * MINUTE), NOW)).toBe("3 minutes ago");
    expect(relativeTime(ago(5 * HOUR), NOW)).toBe("5 hours ago");
    expect(relativeTime(ago(2 * 7 * DAY), NOW)).toBe("2 weeks ago");
    expect(relativeTime(ago(400 * DAY), NOW)).toBe("last year");
  });

  it("truncates rather than rounds, so 6 days is not 'last week'", () => {
    expect(relativeTime(ago(6 * DAY), NOW)).toBe("6 days ago");
    // 1.9 days must read as 1 day, never 2.
    expect(relativeTime(ago(DAY + 22 * HOUR), NOW)).toBe("yesterday");
  });

  it("handles future dates", () => {
    const future = new Date(NOW.getTime() + 3 * DAY).toISOString();
    expect(relativeTime(future, NOW)).toBe("in 3 days");
  });

  it("accepts a Date as well as an ISO string", () => {
    expect(relativeTime(new Date(NOW.getTime() - 2 * DAY), NOW)).toBe(
      "2 days ago",
    );
  });

  it("returns an empty string for an unparseable date", () => {
    expect(relativeTime("not a date", NOW)).toBe("");
  });
});

describe("formatFileSize", () => {
  it("shows whole bytes without a decimal", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
  });

  it("steps up through the units", () => {
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(1024 * 1024)).toBe("1 MB");
    expect(formatFileSize(1024 * 1024 * 1024)).toBe("1 GB");
  });

  it("stops at the largest unit it knows", () => {
    expect(formatFileSize(5 * 1024 * 1024 * 1024 * 1024)).toBe("5120 GB");
  });

  it("returns an empty string for nonsense input", () => {
    expect(formatFileSize(-1)).toBe("");
    expect(formatFileSize(Number.NaN)).toBe("");
  });
});
