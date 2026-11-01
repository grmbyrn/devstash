import { describe, expect, it } from "vitest";

import { createCollectionSchema } from "@/lib/validations/collection";

describe("createCollectionSchema", () => {
  it("accepts a name and trims it", () => {
    const result = createCollectionSchema.safeParse({ name: "  React Patterns  " });

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("React Patterns");
  });

  it("requires a name, and whitespace alone does not count", () => {
    for (const name of ["", "   ", undefined]) {
      const result = createCollectionSchema.safeParse({ name });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Name is required");
    }
  });

  it("caps the name length", () => {
    expect(createCollectionSchema.safeParse({ name: "a".repeat(100) }).success).toBe(true);
    expect(createCollectionSchema.safeParse({ name: "a".repeat(101) }).success).toBe(false);
  });

  it("stores a missing, null or blank description as null", () => {
    for (const description of [undefined, null, "", "   "]) {
      const result = createCollectionSchema.safeParse({ name: "n", description });

      expect(result.data?.description).toBeNull();
    }
  });

  it("trims the description and caps its length", () => {
    expect(
      createCollectionSchema.safeParse({ name: "n", description: "  hooks  " }).data
        ?.description,
    ).toBe("hooks");
    expect(
      createCollectionSchema.safeParse({ name: "n", description: "a".repeat(501) })
        .success,
    ).toBe(false);
  });

  it("strips keys it does not know, such as a userId", () => {
    const result = createCollectionSchema.safeParse({ name: "n", userId: "user_999" });

    expect(result.data).not.toHaveProperty("userId");
  });
});
