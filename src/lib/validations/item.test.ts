import { describe, expect, it } from "vitest";

import { MAX_TAGS, parseTagInput, updateItemSchema } from "@/lib/validations/item";

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
