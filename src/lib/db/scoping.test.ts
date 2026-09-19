import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/prisma-mock";

vi.mock("@/lib/prisma", async () => ({
  prisma: (await import("@/test/prisma-mock")).prismaMock,
}));

const items = await import("./items");
const collections = await import("./collections");

/**
 * Every dashboard and sidebar query used to be hardcoded to the seeded demo
 * account (`DEMO_USER_EMAIL`); the item drawer moved them all to the signed-in
 * user's id. Each one is a read of user-owned data, so a query that forgets its
 * scope shows one account another account's items.
 *
 * These assert the `where` clause carries the caller's `userId` — cheap
 * insurance against that scope being dropped or the demo email creeping back.
 */
describe("user scoping on dashboard queries", () => {
  const USER = "user_1";

  beforeEach(() => {
    prismaMock.item.findMany.mockResolvedValue([]);
    prismaMock.item.count.mockResolvedValue(0);
    prismaMock.collection.findMany.mockResolvedValue([]);
    prismaMock.collection.count.mockResolvedValue(0);
  });

  it("getPinnedItems scopes to the user and to pinned items", async () => {
    await items.getPinnedItems(USER);

    expect(prismaMock.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER, isPinned: true } }),
    );
  });

  it("getRecentItems scopes to the user and honours the limit", async () => {
    await items.getRecentItems(USER, 4);

    expect(prismaMock.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER }, take: 4 }),
    );
  });

  it("getItemsByType scopes to the user as well as the type", async () => {
    await items.getItemsByType(USER, "type_snippet");

    expect(prismaMock.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER, itemTypeId: "type_snippet" },
      }),
    );
  });

  it("createItem creates the row under the given user", async () => {
    prismaMock.item.create.mockResolvedValue({
      id: "item_new",
      title: "t",
      content: null,
      url: null,
      description: null,
      isFavorite: false,
      isPinned: false,
      language: null,
      contentType: "TEXT",
      fileUrl: null,
      fileName: null,
      fileSize: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastUsedAt: null,
      itemType: { id: "t1", name: "note", icon: "StickyNote", color: "#fde047" },
      tags: [],
      collections: [],
    });

    await items.createItem(USER, { itemTypeId: "t1", title: "t" });

    const { data } = prismaMock.item.create.mock.calls[0][0];
    expect(data.user).toEqual({ connect: { id: USER } });
  });

  it("deleteItem scopes the delete to the user, not just the id", async () => {
    prismaMock.item.delete.mockResolvedValue({ id: "item_1" });

    await items.deleteItem(USER, "item_1");

    expect(prismaMock.item.delete).toHaveBeenCalledWith({
      where: { id: "item_1", userId: USER },
    });
  });

  it("getItemStats counts only the user's items", async () => {
    await items.getItemStats(USER);

    expect(prismaMock.item.count).toHaveBeenCalledWith({
      where: { userId: USER },
    });
    expect(prismaMock.item.count).toHaveBeenCalledWith({
      where: { userId: USER, isFavorite: true },
    });
  });

  it("getRecentCollections scopes to the user", async () => {
    await collections.getRecentCollections(USER, 6);

    expect(prismaMock.collection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER }, take: 6 }),
    );
  });

  it("getFavoriteCollections scopes to the user and to favorites", async () => {
    await collections.getFavoriteCollections(USER);

    expect(prismaMock.collection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER, isFavorite: true },
      }),
    );
  });

  it("getCollectionStats counts only the user's collections", async () => {
    await collections.getCollectionStats(USER);

    expect(prismaMock.collection.count).toHaveBeenCalledWith({
      where: { userId: USER },
    });
    expect(prismaMock.collection.count).toHaveBeenCalledWith({
      where: { userId: USER, isFavorite: true },
    });
  });

  it("no query filters by the seeded demo email any more", async () => {
    await Promise.all([
      items.getPinnedItems(USER),
      items.getRecentItems(USER, 10),
      items.getItemStats(USER),
      collections.getFavoriteCollections(USER),
      collections.getCollectionStats(USER),
    ]);

    const everyCall = [
      ...prismaMock.item.findMany.mock.calls,
      ...prismaMock.item.count.mock.calls,
      ...prismaMock.collection.findMany.mock.calls,
      ...prismaMock.collection.count.mock.calls,
    ];

    expect(everyCall.length).toBeGreaterThan(0);
    for (const [args] of everyCall) {
      expect(JSON.stringify(args)).not.toContain("devstash.io");
    }
  });
});
