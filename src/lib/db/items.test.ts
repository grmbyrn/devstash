import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/prisma-mock";

vi.mock("@/lib/prisma", async () => ({
  prisma: (await import("@/test/prisma-mock")).prismaMock,
}));

const {
  createItem,
  deleteItem,
  getItemByFileKey,
  getItemById,
  getItemsByType,
  updateItem,
} = await import("./items");

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
/**
 * The image gallery card renders a thumbnail from the card shape alone, so the
 * card select has to carry the object key — the drawer's detail fetch is too late.
 */
describe("card shape", () => {
  it("carries the upload's key and name to the card", async () => {
    prismaMock.item.findMany.mockResolvedValue([
      {
        id: "item_img",
        title: "Architecture diagram",
        content: null,
        url: null,
        description: null,
        isFavorite: false,
        isPinned: false,
        language: null,
        fileUrl: "user_1/abc.png",
        fileName: "diagram.png",
        itemType: { id: "type_image", name: "image", icon: "Image", color: "#ec4899" },
        tags: [],
      },
    ]);

    const [card] = await getItemsByType("user_1", "type_image");

    expect(prismaMock.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ fileUrl: true, fileName: true }),
      }),
    );
    expect(card).toMatchObject({
      fileUrl: "user_1/abc.png",
      fileName: "diagram.png",
    });
  });
});

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

/**
 * Deletion is irreversible, so the ownership rule in the `where` clause is the
 * only thing standing between a session and someone else's data.
 */
describe("deleteItem", () => {
  beforeEach(() => {
    prismaMock.item.delete.mockResolvedValue({ fileUrl: null });
  });

  it("scopes the delete to the requesting user, not just the id", async () => {
    await deleteItem("user_1", "item_1");

    expect(prismaMock.item.delete).toHaveBeenCalledWith({
      where: { id: "item_1", userId: "user_1" },
      select: { fileUrl: true },
    });
  });

  it("reports success with no key for a text item", async () => {
    await expect(deleteItem("user_1", "item_1")).resolves.toEqual({
      deleted: true,
      fileKey: null,
    });
  });

  /**
   * The R2 key has to come back from the delete itself: once this resolves the
   * row is gone, so a separate read beforehand would be both an extra round
   * trip and a window in which the two could disagree.
   */
  it("returns the R2 key of an upload so the caller can clean it up", async () => {
    prismaMock.item.delete.mockResolvedValue({ fileUrl: "user_1/abc.png" });

    await expect(deleteItem("user_1", "item_1")).resolves.toEqual({
      deleted: true,
      fileKey: "user_1/abc.png",
    });
  });

  /**
   * A foreign or unknown id matches nothing, so Prisma raises P2025. Both must
   * report the same plain absence, so a delete cannot be used to probe which
   * ids exist.
   */
  it("reports absence when the item is not the user's or does not exist", async () => {
    prismaMock.item.delete.mockRejectedValue(
      Object.assign(new Error("Record to delete does not exist."), {
        code: "P2025",
      }),
    );

    await expect(deleteItem("user_2", "item_1")).resolves.toBeNull();
  });

  it("distinguishes a text item deleted from no item deleted", async () => {
    // `{ fileKey: null }` means "deleted, nothing to clean up"; `null` means
    // "nothing happened" — the action branches on the difference.
    const deletedText = await deleteItem("user_1", "item_1");

    prismaMock.item.delete.mockRejectedValue(
      Object.assign(new Error("Record to delete does not exist."), { code: "P2025" }),
    );
    const missing = await deleteItem("user_1", "item_2");

    expect(deletedText).not.toBeNull();
    expect(missing).toBeNull();
  });

  it("rethrows a genuine database failure instead of masking it as not-found", async () => {
    prismaMock.item.delete.mockRejectedValue(
      Object.assign(new Error("connection refused"), { code: "P1001" }),
    );

    await expect(deleteItem("user_1", "item_1")).rejects.toThrow(
      "connection refused",
    );
  });
});

/**
 * The authorisation check behind `GET /api/files/[...key]`. A private bucket is
 * only meaningful if possession of a key proves nothing — what counts is an
 * item *of this user's* referencing it.
 */
describe("getItemByFileKey", () => {
  beforeEach(() => {
    prismaMock.item.findFirst.mockResolvedValue({ id: "item_1", fileName: "pic.png" });
  });

  it("scopes the lookup to the user as well as the key", async () => {
    await getItemByFileKey("user_1", "user_1/abc.png");

    expect(prismaMock.item.findFirst).toHaveBeenCalledWith({
      where: { userId: "user_1", fileUrl: "user_1/abc.png" },
      select: { id: true, fileName: true },
    });
  });

  it("returns the id and display name for the owner", async () => {
    await expect(getItemByFileKey("user_1", "user_1/abc.png")).resolves.toEqual({
      id: "item_1",
      fileName: "pic.png",
    });
  });

  it("returns null when no item of the user's points at the key", async () => {
    prismaMock.item.findFirst.mockResolvedValue(null);

    await expect(getItemByFileKey("user_2", "user_1/abc.png")).resolves.toBeNull();
  });
});

/**
 * `createItem` has no `where` clause to carry ownership — the row doesn't exist
 * yet — so what matters is that the item is created *under* the caller's user
 * and that the reshaped detail comes back the same way every other fetcher
 * returns it.
 */
describe("createItem", () => {
  const createdRow = {
    id: "item_new",
    title: "useDebounce",
    content: "export function useDebounce() {}",
    url: null,
    description: "Debounce a value",
    isFavorite: false,
    isPinned: false,
    language: "typescript",
    contentType: "TEXT",
    fileUrl: null,
    fileName: null,
    fileSize: null,
    createdAt: new Date("2026-09-18T10:00:00.000Z"),
    updatedAt: new Date("2026-09-18T10:00:00.000Z"),
    lastUsedAt: null,
    itemType: {
      id: "type_snippet",
      name: "snippet",
      icon: "Code",
      color: "#3b82f6",
    },
    tags: [{ tag: { name: "react" } }],
    collections: [],
  };

  beforeEach(() => {
    prismaMock.item.create.mockResolvedValue(createdRow);
  });

  it("creates the item under the given user and type", async () => {
    await createItem("user_1", {
      itemTypeId: "type_snippet",
      title: "useDebounce",
    });

    const { data } = prismaMock.item.create.mock.calls[0][0];
    expect(data.user).toEqual({ connect: { id: "user_1" } });
    expect(data.itemType).toEqual({ connect: { id: "type_snippet" } });
  });

  it("defaults to text content when the caller says nothing", async () => {
    await createItem("user_1", { itemTypeId: "type_note", title: "t" });

    const { data } = prismaMock.item.create.mock.calls[0][0];
    expect(data.contentType).toBe("TEXT");
  });

  it("writes the file columns and FILE content type for an upload", async () => {
    await createItem("user_1", {
      itemTypeId: "type_image",
      title: "Logo",
      contentType: "FILE",
      fileUrl: "user_1/abc.png",
      fileName: "logo.png",
      fileSize: 2048,
    });

    const { data } = prismaMock.item.create.mock.calls[0][0];
    expect(data).toMatchObject({
      contentType: "FILE",
      // The R2 object *key*, not a fetchable URL — the bucket is private.
      fileUrl: "user_1/abc.png",
      fileName: "logo.png",
      fileSize: 2048,
    });
  });

  it("leaves the file columns alone for a text item", async () => {
    await createItem("user_1", { itemTypeId: "type_snippet", title: "t" });

    const { data } = prismaMock.item.create.mock.calls[0][0];
    expect(data).not.toHaveProperty("fileUrl");
    expect(data).not.toHaveProperty("fileName");
    expect(data).not.toHaveProperty("fileSize");
  });

  it("writes only the fields it was given", async () => {
    await createItem("user_1", {
      itemTypeId: "type_snippet",
      title: "t",
      content: "echo hi",
    });

    const { data } = prismaMock.item.create.mock.calls[0][0];
    expect(data).toMatchObject({ title: "t", content: "echo hi" });
    expect(data).not.toHaveProperty("url");
    expect(data).not.toHaveProperty("language");
    expect(data).not.toHaveProperty("description");
  });

  it("connects or creates each tag by name", async () => {
    await createItem("user_1", {
      itemTypeId: "type_snippet",
      title: "t",
      tags: ["react", "hooks"],
    });

    const { data } = prismaMock.item.create.mock.calls[0][0];
    expect(data.tags.create).toEqual([
      {
        tag: {
          connectOrCreate: {
            where: { name: "react" },
            create: { name: "react" },
          },
        },
      },
      {
        tag: {
          connectOrCreate: {
            where: { name: "hooks" },
            create: { name: "hooks" },
          },
        },
      },
    ]);
  });

  it("omits the tag write entirely when there are no tags", async () => {
    await createItem("user_1", {
      itemTypeId: "type_snippet",
      title: "t",
      tags: [],
    });

    const { data } = prismaMock.item.create.mock.calls[0][0];
    expect(data).not.toHaveProperty("tags");
  });

  it("returns the detail shape, with dates serialized for the wire", async () => {
    const item = await createItem("user_1", {
      itemTypeId: "type_snippet",
      title: "useDebounce",
    });

    expect(item).toMatchObject({
      id: "item_new",
      title: "useDebounce",
      type: { id: "type_snippet", name: "snippet" },
      tags: ["react"],
      collections: [],
      createdAt: "2026-09-18T10:00:00.000Z",
      lastUsedAt: null,
    });
  });

  it("lets a database failure surface rather than swallowing it", async () => {
    prismaMock.item.create.mockRejectedValue(new Error("connection refused"));

    await expect(
      createItem("user_1", { itemTypeId: "type_snippet", title: "t" }),
    ).rejects.toThrow("connection refused");
  });
});
