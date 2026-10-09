import { describe, expect, it } from "vitest";

import {
  editableFields,
  findTypeBySlug,
  isUploadType,
  typeLabel,
  typeSlug,
  rendersAsMarkdown,
  usesMarkdown,
} from "@/lib/item-types";
import { uploadKindFor } from "@/lib/uploads";

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

describe("isUploadType", () => {
  /**
   * File and image items exist because something was uploaded: the row carries
   * `fileUrl`/`fileName`/`fileSize` and `contentType: FILE` rather than a text
   * body, and the create action refuses one submitted without a stored object.
   */
  it("covers the two upload-backed types", () => {
    expect(isUploadType("file")).toBe(true);
    expect(isUploadType("image")).toBe(true);
  });

  it("is false for the five types created by typing", () => {
    for (const name of ["snippet", "prompt", "command", "note", "link"]) {
      expect(isUploadType(name), name).toBe(false);
    }
  });

  it("is false for an unknown type, so a future custom one isn't sent to R2", () => {
    expect(isUploadType("custom-thing")).toBe(false);
  });

  it("agrees with the upload rules about which types take a file", () => {
    // Two modules answer "does this type take an upload?" — `item-types` for
    // the form, `uploads` for the rules. A type in one but not the other would
    // either show an upload field with no limits or enforce limits on a field
    // that never renders.
    for (const name of SYSTEM_TYPE_NAMES) {
      expect(isUploadType(name), name).toBe(uploadKindFor(name) !== null);
    }
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


describe("rendersAsMarkdown", () => {
  it("is always true for the prose types, whatever the language says", () => {
    for (const lang of [null, undefined, "typescript", "markdown"]) {
      expect(rendersAsMarkdown("note", lang)).toBe(true);
      expect(rendersAsMarkdown("prompt", lang)).toBe(true);
    }
  });

  /**
   * The case this was built for: a README or runbook filed as a snippet. The
   * author marks it `markdown` and it renders as a document, not as code.
   */
  it("opts a snippet or command in when its language is markdown", () => {
    expect(rendersAsMarkdown("snippet", "markdown")).toBe(true);
    expect(rendersAsMarkdown("command", "markdown")).toBe(true);
  });

  it("accepts the aliases and casing a user might actually type", () => {
    for (const lang of ["md", "mdx", "Markdown", "  MD  ", ".md"]) {
      expect(rendersAsMarkdown("snippet", lang)).toBe(true);
    }
  });

  /**
   * The regression that matters. A Dockerfile and a shell script are full of
   * lines starting with `#`; a content heuristic reads those as headings. The
   * language check must leave them on Monaco.
   */
  it("leaves real code on the code editor", () => {
    for (const lang of [
      "dockerfile",
      "terminal",
      "bash",
      "sh",
      "typescript",
      "python",
      "sql",
      "css",
    ]) {
      expect(rendersAsMarkdown("snippet", lang)).toBe(false);
    }
  });

  it("treats a snippet with no language as code, not markdown", () => {
    expect(rendersAsMarkdown("snippet", null)).toBe(false);
    expect(rendersAsMarkdown("command", undefined)).toBe(false);
    expect(rendersAsMarkdown("snippet", "")).toBe(false);
  });

  /**
   * Types with no language field can't opt in this way, so a stray `markdown`
   * on a link row cannot turn its (nonexistent) body into a document.
   */
  it("ignores the language on types that have no language field", () => {
    for (const name of ["link", "file", "image"]) {
      expect(rendersAsMarkdown(name, "markdown")).toBe(false);
    }
  });

  it("degrades safely for an unknown type", () => {
    expect(rendersAsMarkdown("custom-thing", "markdown")).toBe(false);
  });
});
