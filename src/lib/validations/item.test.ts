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
