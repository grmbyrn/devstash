import { describe, expect, it } from "vitest";

import {
  createItemSchema,
  MAX_TAGS,
  parseTagInput,
  updateItemSchema,
} from "@/lib/validations/item";

describe("parseTagInput", () => {
  it("splits on commas and trims each tag", () => {
    expect(parseTagInput("react, hooks ,  state")).toEqual([
      "react",
      "hooks",
      "state",
    ]);
  });

  it("drops blank entries, so a trailing comma while typing is harmless", () => {
    expect(parseTagInput("react,,hooks,")).toEqual(["react", "hooks"]);
    expect(parseTagInput("  ,  ")).toEqual([]);
    expect(parseTagInput("")).toEqual([]);
  });
});

describe("updateItemSchema — title", () => {
  it("requires a title", () => {
    const result = updateItemSchema.safeParse({ title: "" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Title is required");
  });

  it("rejects a title that is only whitespace", () => {
    expect(updateItemSchema.safeParse({ title: "   " }).success).toBe(false);
  });

  it("trims the stored title", () => {
    const result = updateItemSchema.parse({ title: "  useDebounce  " });

    expect(result.title).toBe("useDebounce");
  });
});

/**
 * The three-state handling is the whole point of the schema: absent must stay
 * absent so a partial save cannot wipe a column it never showed the user.
 */
describe("updateItemSchema — absent vs cleared", () => {
  it("leaves absent fields absent", () => {
    const result = updateItemSchema.parse({ title: "Note" });

    expect("description" in result).toBe(false);
    expect("url" in result).toBe(false);
    expect("content" in result).toBe(false);
    expect("language" in result).toBe(false);
  });

  it("turns an empty or whitespace field into an explicit null", () => {
    expect(updateItemSchema.parse({ title: "t", description: "" }).description)
      .toBeNull();
    expect(updateItemSchema.parse({ title: "t", description: "   " }).description)
      .toBeNull();
    expect(updateItemSchema.parse({ title: "t", description: null }).description)
      .toBeNull();
  });

  it("trims a field that has a value", () => {
    expect(
      updateItemSchema.parse({ title: "t", description: "  hi  " }).description,
    ).toBe("hi");
  });
});

describe("updateItemSchema — url", () => {
  it("accepts a valid URL", () => {
    const result = updateItemSchema.safeParse({
      title: "Docs",
      url: "https://example.com/a?b=1",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a malformed URL", () => {
    const result = updateItemSchema.safeParse({ title: "Docs", url: "not a url" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Enter a valid URL");
  });

  it("treats a cleared URL as null rather than invalid", () => {
    const result = updateItemSchema.safeParse({ title: "Docs", url: "" });

    expect(result.success).toBe(true);
    expect(result.data?.url).toBeNull();
  });
});

describe("updateItemSchema — tags", () => {
  it("trims each tag", () => {
    expect(updateItemSchema.parse({ title: "t", tags: [" react "] }).tags).toEqual(
      ["react"],
    );
  });

  it("rejects an empty tag", () => {
    const result = updateItemSchema.safeParse({ title: "t", tags: ["ok", "  "] });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Tags cannot be empty");
  });

  it("dedupes case-insensitively, keeping the first spelling", () => {
    const result = updateItemSchema.parse({
      title: "t",
      tags: ["React", "react", "REACT", "hooks"],
    });

    expect(result.tags).toEqual(["React", "hooks"]);
  });

  it("caps the number of tags", () => {
    const tooMany = Array.from({ length: MAX_TAGS + 1 }, (_, i) => `tag${i}`);
    const result = updateItemSchema.safeParse({ title: "t", tags: tooMany });

    expect(result.success).toBe(false);
  });
});

describe("createItemSchema", () => {
  const base = { itemTypeId: "type_snippet", title: "useDebounce" };

  it("accepts a minimal payload of just a type and a title", () => {
    const result = createItemSchema.safeParse(base);

    expect(result.success).toBe(true);
    expect(result.data?.itemTypeId).toBe("type_snippet");
    expect(result.data?.title).toBe("useDebounce");
  });

  it("requires an item type", () => {
    const result = createItemSchema.safeParse({ title: "t" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Choose an item type");
  });

  it("requires a non-blank title", () => {
    const result = createItemSchema.safeParse({ ...base, title: "   " });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Title is required");
  });

  it("trims the title and the text fields", () => {
    const result = createItemSchema.parse({
      ...base,
      title: "  Spaced  ",
      description: "  a note  ",
    });

    expect(result.title).toBe("Spaced");
    expect(result.description).toBe("a note");
  });

  /**
   * On create there is no existing row to leave alone, so both an absent field
   * and a blank one mean the same thing: nothing to write.
   */
  it("treats a blank optional field as unset", () => {
    const result = createItemSchema.parse({ ...base, description: "   " });

    expect(result.description).toBeNull();
  });

  it("rejects a url that is not a url", () => {
    const result = createItemSchema.safeParse({ ...base, url: "not a url" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Enter a valid URL");
  });

  it("accepts a valid url", () => {
    const result = createItemSchema.parse({
      ...base,
      url: "https://example.com/docs",
    });

    expect(result.url).toBe("https://example.com/docs");
  });

  /**
   * Requiring a url for links needs the type row, so it lives in the action —
   * the schema itself must let a missing url through.
   */
  it("does not require a url, since that rule depends on the type", () => {
    expect(createItemSchema.safeParse(base).success).toBe(true);
  });

  it("shares the tag rules with updateItemSchema", () => {
    const result = createItemSchema.parse({
      ...base,
      tags: ["React", "react", "hooks"],
    });

    expect(result.tags).toEqual(["React", "hooks"]);

    const tooMany = Array.from({ length: MAX_TAGS + 1 }, (_, i) => `tag${i}`);
    expect(
      createItemSchema.safeParse({ ...base, tags: tooMany }).success,
    ).toBe(false);
  });

  it("strips keys it does not know about", () => {
    const result = createItemSchema.parse({
      ...base,
      userId: "user_999",
      isPinned: true,
    });

    expect(result).not.toHaveProperty("userId");
    expect(result).not.toHaveProperty("isPinned");
  });
});

describe("createItemSchema — upload fields", () => {
  const upload = {
    itemTypeId: "type_image",
    title: "Logo",
    fileKey: "user_1/abc123.png",
    fileName: "logo.png",
    fileSize: 2048,
  };

  it("accepts a key, name and size", () => {
    const result = createItemSchema.parse(upload);

    expect(result).toMatchObject({
      fileKey: "user_1/abc123.png",
      fileName: "logo.png",
      fileSize: 2048,
    });
  });

  it("leaves them undefined when the payload omits them", () => {
    // A text item sends none of these, and must not acquire null columns.
    const result = createItemSchema.parse({
      itemTypeId: "type_snippet",
      title: "t",
    });

    expect(result.fileKey).toBeUndefined();
    expect(result.fileSize).toBeUndefined();
  });

  it("refuses a size larger than the biggest upload tier", () => {
    const result = createItemSchema.safeParse({
      ...upload,
      fileSize: 11 * 1024 * 1024,
    });

    expect(result.success).toBe(false);
  });

  it("refuses a negative, zero or fractional size", () => {
    for (const fileSize of [-1, 0, 12.5]) {
      expect(createItemSchema.safeParse({ ...upload, fileSize }).success).toBe(false);
    }
  });

  it("refuses a size that isn't a number", () => {
    expect(
      createItemSchema.safeParse({ ...upload, fileSize: "2048" }).success,
    ).toBe(false);
  });

  it("accepts a null size, since it is display-only", () => {
    expect(createItemSchema.safeParse({ ...upload, fileSize: null }).success).toBe(true);
  });

  it("refuses an absurdly long file name", () => {
    // It is stored, rendered, and echoed into the download's
    // `Content-Disposition`, so an unbounded name is both junk in the column
    // and an oversized response header.
    const result = createItemSchema.safeParse({
      ...upload,
      fileName: `${"a".repeat(300)}.png`,
    });

    expect(result.success).toBe(false);
  });

  it("accepts a file name at the 255-character convention", () => {
    const name = `${"a".repeat(251)}.png`;
    expect(createItemSchema.safeParse({ ...upload, fileName: name }).success).toBe(true);
  });

  it("trims the key and treats a blank one as absent", () => {
    // A blank key reaching the action is refused there as "upload a file
    // first" — the schema's job is only to normalise it to null.
    expect(createItemSchema.parse({ ...upload, fileKey: "  " }).fileKey).toBeNull();
  });

  /**
   * The schema deliberately doesn't check that the key belongs to the caller:
   * that needs the session, so it lives in the action. This pins the division —
   * a key naming another user parses fine and is rejected later.
   */
  it("does not police key ownership, which the action does", () => {
    expect(
      createItemSchema.safeParse({ ...upload, fileKey: "user_2/abc.png" }).success,
    ).toBe(true);
  });

  it("is not part of the update payload, so an edit can't repoint a file", () => {
    const result = updateItemSchema.parse({
      title: "t",
      fileKey: "user_1/other.png",
      fileSize: 10,
    });

    expect(result).not.toHaveProperty("fileKey");
    expect(result).not.toHaveProperty("fileSize");
  });
});
