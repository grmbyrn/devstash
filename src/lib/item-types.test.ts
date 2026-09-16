import { describe, expect, it } from "vitest";

import {
  editableFields,
  findTypeBySlug,
  typeLabel,
  typeSlug,
} from "@/lib/item-types";

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

/**
 * Drives which inputs the drawer's edit mode renders, and therefore which keys
 * the save payload carries. A type that wrongly claims a field would let a save
 * write a column that type never uses.
 */
describe("editableFields", () => {
  it("gives snippets content and language, but no url", () => {
    expect(editableFields("snippet")).toEqual({
      content: true,
      language: true,
      url: false,
    });
  });

  it("gives commands content and language", () => {
    expect(editableFields("command")).toEqual({
      content: true,
      language: true,
      url: false,
    });
  });

  it("gives prompts and notes content only", () => {
    for (const name of ["prompt", "note"]) {
      expect(editableFields(name)).toEqual({
        content: true,
        language: false,
        url: false,
      });
    }
  });

  it("gives links a url and no content", () => {
    expect(editableFields("link")).toEqual({
      content: false,
      language: false,
      url: true,
    });
  });

  it("gives file and image types none of the three", () => {
    for (const name of ["file", "image"]) {
      expect(editableFields(name)).toEqual({
        content: false,
        language: false,
        url: false,
      });
    }
  });

  it("degrades safely for an unknown type rather than guessing", () => {
    expect(editableFields("custom-thing")).toEqual({
      content: false,
      language: false,
      url: false,
    });
  });
});
