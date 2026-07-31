import { describe, expect, it } from "vitest";

import { findTypeBySlug, typeLabel, typeSlug } from "@/lib/item-types";

describe("typeSlug", () => {
  it("pluralizes the stored singular name", () => {
    expect(typeSlug("snippet")).toBe("snippets");
    expect(typeSlug("image")).toBe("images");
  });
});

describe("typeLabel", () => {
  it("capitalizes and pluralizes", () => {
    expect(typeLabel("prompt")).toBe("Prompts");
    expect(typeLabel("file")).toBe("Files");
  });
});

describe("findTypeBySlug", () => {
  const types = [
    { name: "snippet", color: "#3b82f6" },
    { name: "note", color: "#fde047" },
  ];

  it("resolves a URL segment back to its type", () => {
    expect(findTypeBySlug(types, "snippets")).toBe(types[0]);
    expect(findTypeBySlug(types, "notes")).toBe(types[1]);
  });

  it("returns undefined for an unknown slug", () => {
    expect(findTypeBySlug(types, "bogus")).toBeUndefined();
  });

  it("rejects the singular name, so only real URLs match", () => {
    // The route 404s on `/items/snippet`; only `typeSlug` output is valid.
    expect(findTypeBySlug(types, "snippet")).toBeUndefined();
  });

  it("stays symmetric with typeSlug for every type", () => {
    for (const type of types) {
      expect(findTypeBySlug(types, typeSlug(type.name))).toBe(type);
    }
  });
});
