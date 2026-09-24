import { describe, expect, it } from "vitest";

import {
  editableFields,
  findTypeBySlug,
  isCreatableType,
  typeLabel,
  typeSlug,
  usesMarkdown,
} from "@/lib/item-types";

/** The seeded system types, in the order `prisma/seed.ts` creates them. */
const SYSTEM_TYPE_NAMES = [
  "snippet",
  "prompt",
  "command",
  "note",
  "link",
  "file",
  "image",
];

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

describe("isCreatableType", () => {
  it("allows the five types that are created by typing", () => {
    for (const name of ["snippet", "prompt", "command", "note", "link"]) {
      expect(isCreatableType(name)).toBe(true);
    }
  });

  /**
   * File and image items exist because something was uploaded — creating one
   * from a form would write a FILE item with no file.
   */
  it("refuses the upload-backed types", () => {
    expect(isCreatableType("file")).toBe(false);
    expect(isCreatableType("image")).toBe(false);
  });

  it("allows an unknown type rather than blocking a future custom one", () => {
    expect(isCreatableType("custom-thing")).toBe(true);
  });
});

describe("usesMarkdown", () => {
  it("covers the prose types", () => {
    expect(usesMarkdown("note")).toBe(true);
    expect(usesMarkdown("prompt")).toBe(true);
  });

  it("leaves the code types to the code editor", () => {
    expect(usesMarkdown("snippet")).toBe(false);
    expect(usesMarkdown("command")).toBe(false);
  });

  it("is false for types with no content body at all", () => {
    for (const name of ["link", "file", "image"]) {
      expect(usesMarkdown(name)).toBe(false);
    }
  });

  it("degrades safely for an unknown type rather than guessing", () => {
    expect(usesMarkdown("custom-thing")).toBe(false);
  });

  /**
   * `usesMarkdown` duplicates something `editableFields` already implies: among
   * the types that have content, the ones without a language are exactly the
   * prose ones. The lists are kept separate because they encode different
   * decisions, so this pins them to the same answer — if someone adds a content
   * type to one set and forgets the other, the editor a type gets would
   * silently change, and this fails instead.
   */
  it("agrees with editableFields across every system type", () => {
    for (const name of SYSTEM_TYPE_NAMES) {
      const fields = editableFields(name);
      expect(usesMarkdown(name)).toBe(fields.content && !fields.language);
    }
  });
});
