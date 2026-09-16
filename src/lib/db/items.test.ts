import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/prisma-mock";

vi.mock("@/lib/prisma", async () => ({
  prisma: (await import("@/test/prisma-mock")).prismaMock,
}));

const { getItemById } = await import("./items");

/**
 * `src/lib/db` is normally out of unit-test scope (thin I/O), but `getItemById`
 * carries the drawer's authorization rule and serializes dates for the wire —
 * both worth pinning down.
 */
describe("getItemById", () => {
  const row = {
    id: "item_1",
    title: "Git force push safely",
    content: "git push --force-with-lease",
    url: null,
    description: null,
    isFavorite: true,
    isPinned: false,
    language: "bash",
    contentType: "TEXT",
    fileUrl: null,
    fileName: null,
    fileSize: null,
    createdAt: new Date("2026-07-01T10:00:00.000Z"),
    updatedAt: new Date("2026-07-28T09:30:00.000Z"),
    lastUsedAt: null,
    itemType: {
      id: "type_command",
      name: "command",
      icon: "Terminal",
      color: "#f97316",
    },
    tags: [{ tag: { name: "git" } }, { tag: { name: "safety" } }],
    collections: [{ collection: { id: "col_1", name: "DevOps Commands" } }],
  };

  beforeEach(() => {
    prismaMock.item.findFirst.mockResolvedValue(row);
  });

  it("scopes the query to the requesting user, not just the id", async () => {
    await getItemById("user_1", "item_1");

    expect(prismaMock.item.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "item_1", userId: "user_1" },
      }),
    );
  });

  it("returns null when the item is not the user's", async () => {
    prismaMock.item.findFirst.mockResolvedValue(null);

    expect(await getItemById("user_2", "item_1")).toBeNull();
  });

  it("flattens tags and collections to the shapes the drawer renders", async () => {
    const item = await getItemById("user_1", "item_1");

    expect(item?.tags).toEqual(["git", "safety"]);
    expect(item?.collections).toEqual([{ id: "col_1", name: "DevOps Commands" }]);
  });

  it("serializes dates to ISO strings so they survive JSON", async () => {
    const item = await getItemById("user_1", "item_1");

    expect(item?.createdAt).toBe("2026-07-01T10:00:00.000Z");
    expect(item?.updatedAt).toBe("2026-07-28T09:30:00.000Z");
    expect(item?.lastUsedAt).toBeNull();
  });

  it("keeps a real lastUsedAt", async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      ...row,
      lastUsedAt: new Date("2026-07-29T08:00:00.000Z"),
    });

    const item = await getItemById("user_1", "item_1");

    expect(item?.lastUsedAt).toBe("2026-07-29T08:00:00.000Z");
  });

  it("carries the type summary and file metadata through", async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      ...row,
      contentType: "FILE",
      content: null,
      fileUrl: "https://r2.example/logo.png",
      fileName: "logo.png",
      fileSize: 2048,
    });

    const item = await getItemById("user_1", "item_1");

    expect(item?.type).toEqual(row.itemType);
    expect(item?.contentType).toBe("FILE");
    expect(item?.fileName).toBe("logo.png");
    expect(item?.fileSize).toBe(2048);
  });
});
