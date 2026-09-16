import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/prisma-mock";

vi.mock("@/lib/prisma", async () => ({
  prisma: (await import("@/test/prisma-mock")).prismaMock,
}));

const { getItemById, updateItem } = await import("./items");

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

/**
 * `updateItem` carries the same authorization rule as `getItemById` — plus the
 * tag replacement and the partial-update semantics that keep a save from
 * clearing a column the drawer never showed.
 */
describe("updateItem", () => {
  const updatedRow = {
    id: "item_1",
    title: "Force push safely",
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
    updatedAt: new Date("2026-09-17T12:00:00.000Z"),
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
    prismaMock.item.update.mockResolvedValue(updatedRow);
  });

  it("scopes the write to the requesting user, not just the id", async () => {
    await updateItem("user_1", "item_1", { title: "Force push safely" });

    expect(prismaMock.item.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "item_1", userId: "user_1" } }),
    );
  });

  it("writes only the fields it was given", async () => {
    await updateItem("user_1", "item_1", { title: "t", content: "echo hi" });

    const { data } = prismaMock.item.update.mock.calls[0][0];
    expect(data).toMatchObject({ title: "t", content: "echo hi" });
    expect(data).not.toHaveProperty("url");
    expect(data).not.toHaveProperty("description");
    expect(data).not.toHaveProperty("language");
  });

  it("writes an explicit null when a field was cleared", async () => {
    await updateItem("user_1", "item_1", { title: "t", description: null });

    const { data } = prismaMock.item.update.mock.calls[0][0];
    expect(data).toHaveProperty("description", null);
  });

  it("replaces tags wholesale, connecting or creating each by name", async () => {
    await updateItem("user_1", "item_1", { title: "t", tags: ["git", "new"] });

    const { data } = prismaMock.item.update.mock.calls[0][0];
    expect(data.tags.deleteMany).toEqual({});
    expect(data.tags.create).toEqual([
      { tag: { connectOrCreate: { where: { name: "git" }, create: { name: "git" } } } },
      { tag: { connectOrCreate: { where: { name: "new" }, create: { name: "new" } } } },
    ]);
  });

  it("clears every tag when given an empty array", async () => {
    await updateItem("user_1", "item_1", { title: "t", tags: [] });

    const { data } = prismaMock.item.update.mock.calls[0][0];
    expect(data.tags).toEqual({ deleteMany: {}, create: [] });
  });

  it("leaves tags alone when the payload omits them", async () => {
    await updateItem("user_1", "item_1", { title: "t" });

    const { data } = prismaMock.item.update.mock.calls[0][0];
    expect(data).not.toHaveProperty("tags");
  });

  it("returns the refreshed detail with dates serialized for the wire", async () => {
    const result = await updateItem("user_1", "item_1", { title: "t" });

    expect(result).toMatchObject({
      id: "item_1",
      title: "Force push safely",
      updatedAt: "2026-09-17T12:00:00.000Z",
      tags: ["git", "safety"],
    });
  });

  /**
   * A foreign or unknown id matches nothing, so Prisma raises P2025. That must
   * become a plain "absent" rather than a thrown error, so the caller answers
   * "not found" and never reveals which ids exist.
   */
  it("returns null when the item is not the user's or does not exist", async () => {
    prismaMock.item.update.mockRejectedValue(
      Object.assign(new Error("Record to update not found."), { code: "P2025" }),
    );

    await expect(updateItem("user_1", "item_x", { title: "t" })).resolves.toBeNull();
  });

  it("rethrows a genuine database failure instead of masking it as not-found", async () => {
    prismaMock.item.update.mockRejectedValue(
      Object.assign(new Error("connection refused"), { code: "P1001" }),
    );

    await expect(updateItem("user_1", "item_1", { title: "t" })).rejects.toThrow(
      "connection refused",
    );
  });
});
