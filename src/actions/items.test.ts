import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const createItemQueryMock = vi.fn();
const updateItemQueryMock = vi.fn();
const deleteItemQueryMock = vi.fn();
const getSystemItemTypesMock = vi.fn();

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db/items", () => ({
  createItem: createItemQueryMock,
  updateItem: updateItemQueryMock,
  deleteItem: deleteItemQueryMock,
  getSystemItemTypes: getSystemItemTypesMock,
}));

const deleteObjectQuietlyMock = vi.fn();
vi.mock("@/lib/r2", async () => {
  // `objectKeyOwner` is pure and is part of the rule the action enforces, so
  // the real one is kept rather than stubbed.
  const actual = await vi.importActual<typeof import("@/lib/r2")>("@/lib/r2");
  return {
    objectKeyOwner: actual.objectKeyOwner,
    deleteObjectQuietly: deleteObjectQuietlyMock,
  };
});

const { createItem, deleteItem, updateItem } = await import("./items");

/** The system types the create action resolves `itemTypeId` against. */
const SYSTEM_TYPES = [
  { id: "type_snippet", name: "snippet", icon: "Code", color: "#3b82f6" },
  { id: "type_note", name: "note", icon: "StickyNote", color: "#fde047" },
  { id: "type_link", name: "link", icon: "Link", color: "#10b981" },
  { id: "type_file", name: "file", icon: "File", color: "#6b7280" },
  { id: "type_image", name: "image", icon: "Image", color: "#ec4899" },
];

const SESSION = { user: { id: "user_1" } };

const savedItem = {
  id: "item_1",
  title: "useDebounce",
  type: { id: "type_snippet", name: "snippet", icon: "Code", color: "#3b82f6" },
  tags: ["react"],
};

describe("updateItem action", () => {
  beforeEach(() => {
    authMock.mockResolvedValue(SESSION);
    updateItemQueryMock.mockResolvedValue(savedItem);
  });

  it("saves a valid edit and returns the refreshed detail", async () => {
    const result = await updateItem("item_1", {
      title: "useDebounce",
      description: "Debounce a value",
      tags: ["react"],
    });

    expect(result).toEqual({ success: true, data: savedItem });
  });

  it("passes the session's user id to the query, not anything from the caller", async () => {
    await updateItem("item_1", { title: "t", userId: "user_999" });

    expect(updateItemQueryMock).toHaveBeenCalledWith(
      "user_1",
      "item_1",
      expect.objectContaining({ title: "t" }),
    );
    // The unknown key is stripped by the schema rather than forwarded.
    expect(updateItemQueryMock.mock.calls[0][2]).not.toHaveProperty("userId");
  });

  it("refuses when there is no session, without touching the database", async () => {
    authMock.mockResolvedValue(null);

    const result = await updateItem("item_1", { title: "t" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("You need to be signed in to do that.");
    expect(updateItemQueryMock).not.toHaveBeenCalled();
  });

  it("returns the validation message for an empty title, without writing", async () => {
    const result = await updateItem("item_1", { title: "  " });

    expect(result).toEqual({ success: false, error: "Title is required" });
    expect(updateItemQueryMock).not.toHaveBeenCalled();
  });

  it("returns the validation message for a malformed url", async () => {
    const result = await updateItem("item_1", { title: "t", url: "nope" });

    expect(result).toEqual({ success: false, error: "Enter a valid URL" });
    expect(updateItemQueryMock).not.toHaveBeenCalled();
  });

  it("rejects a missing item id before validating anything else", async () => {
    const result = await updateItem("", { title: "t" });

    expect(result).toEqual({ success: false, error: "Item not found." });
    expect(updateItemQueryMock).not.toHaveBeenCalled();
  });

  /**
   * The query returns null both for an unknown id and for another user's item.
   * The action must not distinguish them, or it leaks which ids exist.
   */
  it("reports an item it cannot update as simply not found", async () => {
    updateItemQueryMock.mockResolvedValue(null);

    const result = await updateItem("item_someone_else", { title: "t" });

    expect(result).toEqual({ success: false, error: "Item not found." });
  });

  it("does not leak a database error message to the caller", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    updateItemQueryMock.mockRejectedValue(
      new Error("connection to db-prod-7 refused"),
    );

    const result = await updateItem("item_1", { title: "t" });

    expect(result).toEqual({
      success: false,
      error: "Something went wrong. Please try again.",
    });
    consoleSpy.mockRestore();
  });

  it("only forwards the fields that were sent, so a partial save stays partial", async () => {
    await updateItem("item_1", { title: "t", content: "x" });

    const payload = updateItemQueryMock.mock.calls[0][2];
    expect(payload).toHaveProperty("content", "x");
    expect(payload).not.toHaveProperty("url");
    expect(payload).not.toHaveProperty("language");
  });
});

describe("deleteItem action", () => {
  beforeEach(() => {
    authMock.mockResolvedValue(SESSION);
    deleteItemQueryMock.mockResolvedValue({ deleted: true, fileKey: null });
  });

  it("deletes the item and reports success", async () => {
    const result = await deleteItem("item_1");

    expect(result).toEqual({ success: true, data: null });
  });

  it("passes the session's user id to the query, not anything from the caller", async () => {
    await deleteItem("item_1");

    expect(deleteItemQueryMock).toHaveBeenCalledWith("user_1", "item_1");
  });

  it("refuses when there is no session, without touching the database", async () => {
    authMock.mockResolvedValue(null);

    const result = await deleteItem("item_1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("You need to be signed in to do that.");
    expect(deleteItemQueryMock).not.toHaveBeenCalled();
  });

  it("rejects an empty id without touching the database", async () => {
    const result = await deleteItem("");

    expect(result).toEqual({ success: false, error: "Item not found." });
    expect(deleteItemQueryMock).not.toHaveBeenCalled();
  });

  /**
   * Someone else's item and an id that never existed must be indistinguishable
   * from the outside.
   */
  it("reports a foreign item exactly as it reports an unknown one", async () => {
    deleteItemQueryMock.mockResolvedValue(null);

    const foreign = await deleteItem("item_owned_by_someone_else");
    const unknown = await deleteItem("item_does_not_exist");

    expect(foreign).toEqual({ success: false, error: "Item not found." });
    expect(foreign).toEqual(unknown);
  });

  it("never hands a database error message to the client", async () => {
    deleteItemQueryMock.mockRejectedValue(
      new Error("connection to db-prod-01 refused"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await deleteItem("item_1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Something went wrong. Please try again.");
    expect(result.error).not.toContain("db-prod-01");
  });

  describe("stored objects", () => {
    it("removes the R2 object belonging to an upload", async () => {
      deleteItemQueryMock.mockResolvedValue({
        deleted: true,
        fileKey: "user_1/abc.png",
      });

      const result = await deleteItem("item_1");

      expect(result.success).toBe(true);
      expect(deleteObjectQuietlyMock).toHaveBeenCalledWith("user_1/abc.png");
    });

    it("skips storage entirely for a text item", async () => {
      await deleteItem("item_1");

      expect(deleteObjectQuietlyMock).not.toHaveBeenCalled();
    });

    it("does not touch storage when there was nothing to delete", async () => {
      // No row removed means the key was never ours to clean up.
      deleteItemQueryMock.mockResolvedValue(null);

      await deleteItem("item_1");

      expect(deleteObjectQuietlyMock).not.toHaveBeenCalled();
    });

    it("still reports success when the object cleanup fails", async () => {
      // The row is already gone, so the user's delete did succeed — an R2
      // outage must not report otherwise. `deleteObjectQuietly` swallows the
      // error itself; this pins that the action relies on that.
      deleteItemQueryMock.mockResolvedValue({
        deleted: true,
        fileKey: "user_1/abc.png",
      });
      deleteObjectQuietlyMock.mockResolvedValue(undefined);

      await expect(deleteItem("item_1")).resolves.toEqual({
        success: true,
        data: null,
      });
    });
  });
});

describe("createItem action", () => {
  const createdItem = { ...savedItem, id: "item_new" };

  beforeEach(() => {
    authMock.mockResolvedValue(SESSION);
    getSystemItemTypesMock.mockResolvedValue(SYSTEM_TYPES);
    createItemQueryMock.mockResolvedValue(createdItem);
  });

  it("creates a valid item and returns its detail", async () => {
    const result = await createItem({
      itemTypeId: "type_snippet",
      title: "useDebounce",
      tags: ["react"],
    });

    expect(result).toEqual({ success: true, data: createdItem });
  });

  it("passes the session's user id to the query, not anything from the caller", async () => {
    await createItem({
      itemTypeId: "type_snippet",
      title: "t",
      userId: "user_999",
    });

    expect(createItemQueryMock).toHaveBeenCalledWith(
      "user_1",
      expect.objectContaining({ title: "t", itemTypeId: "type_snippet" }),
    );
    expect(createItemQueryMock.mock.calls[0][1]).not.toHaveProperty("userId");
  });

  it("refuses when there is no session, without touching the database", async () => {
    authMock.mockResolvedValue(null);

    const result = await createItem({
      itemTypeId: "type_snippet",
      title: "t",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("You need to be signed in to do that.");
    expect(createItemQueryMock).not.toHaveBeenCalled();
  });

  it("stops at validation before writing anything", async () => {
    const result = await createItem({ itemTypeId: "type_snippet", title: "" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Title is required");
    expect(createItemQueryMock).not.toHaveBeenCalled();
  });

  /**
   * The type id comes from the client, so it is resolved against the real
   * system types rather than handed to the database on trust.
   */
  it("refuses an item type that does not exist", async () => {
    const result = await createItem({
      itemTypeId: "type_made_up",
      title: "t",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Choose an item type.");
    expect(createItemQueryMock).not.toHaveBeenCalled();
  });

  it("refuses an upload-backed type with no uploaded object", async () => {
    // A file item with no key would be a row pointing at nothing.
    const result = await createItem({ itemTypeId: "type_file", title: "t" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Upload a file first.");
    expect(createItemQueryMock).not.toHaveBeenCalled();
  });

  it("drops fields the chosen type does not use", async () => {
    await createItem({
      itemTypeId: "type_note",
      title: "t",
      content: "a note",
      language: "typescript",
      url: "https://example.com",
    });

    const data = createItemQueryMock.mock.calls[0][1];
    expect(data).toHaveProperty("content", "a note");
    // A note has no language and no url, whatever the payload claimed.
    expect(data).not.toHaveProperty("language");
    expect(data).not.toHaveProperty("url");
  });

  describe("upload types", () => {
    const upload = {
      itemTypeId: "type_image",
      title: "Logo",
      fileKey: "user_1/abc123.png",
      fileName: "logo.png",
      fileSize: 2048,
    };

    it("stores the key, name and size and marks the item as FILE", async () => {
      await createItem(upload);

      expect(createItemQueryMock.mock.calls[0][1]).toMatchObject({
        contentType: "FILE",
        fileUrl: "user_1/abc123.png",
        fileName: "logo.png",
        fileSize: 2048,
      });
    });

    /**
     * The key is client-supplied, and its prefix is the owner. Checking it
     * against the session is what stops a crafted payload adopting another
     * user's object — the upload route always builds keys from the session, so
     * a legitimate key matches by construction.
     */
    it("refuses a key whose prefix names another user", async () => {
      const result = await createItem({ ...upload, fileKey: "user_2/abc123.png" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("That upload isn't available.");
      expect(createItemQueryMock).not.toHaveBeenCalled();
    });

    it("refuses a malformed key", async () => {
      for (const fileKey of ["abc123.png", "user_1/nested/abc.png", "/abc.png"]) {
        createItemQueryMock.mockClear();
        const result = await createItem({ ...upload, fileKey });

        expect(result.success, fileKey).toBe(false);
        expect(createItemQueryMock).not.toHaveBeenCalled();
      }
    });

    it("ignores a file key sent for a text type", async () => {
      // A snippet carrying upload fields must not become a FILE item.
      await createItem({
        itemTypeId: "type_snippet",
        title: "t",
        content: "echo hi",
        fileKey: "user_1/abc123.png",
        fileName: "logo.png",
        fileSize: 2048,
      });

      const data = createItemQueryMock.mock.calls[0][1];
      expect(data).not.toHaveProperty("fileUrl");
      expect(data).not.toHaveProperty("fileName");
      expect(data).not.toHaveProperty("fileSize");
      expect(data.contentType).toBeUndefined();
    });

    it("tolerates a missing name and size, which are display-only", async () => {
      await createItem({ itemTypeId: "type_file", title: "t", fileKey: "user_1/a.pdf" });

      expect(createItemQueryMock.mock.calls[0][1]).toMatchObject({
        fileUrl: "user_1/a.pdf",
        fileName: null,
        fileSize: null,
      });
    });

    it("refuses a negative or absurd reported size", async () => {
      const tooBig = await createItem({ ...upload, fileSize: 999 * 1024 * 1024 });
      const negative = await createItem({ ...upload, fileSize: -1 });

      expect(tooBig.success).toBe(false);
      expect(negative.success).toBe(false);
      expect(createItemQueryMock).not.toHaveBeenCalled();
    });

    it("refuses a key whose extension is wrong for the chosen type", async () => {
      // A .pdf uploaded as a `file` is valid; reusing that key for an `image`
      // item is not — the type decides which extensions are allowed.
      const result = await createItem({
        itemTypeId: "type_image",
        title: "Logo",
        fileKey: "user_1/abc123.pdf",
        fileName: "doc.pdf",
        fileSize: 2048,
      });

      expect(result.success).toBe(false);
      expect(createItemQueryMock).not.toHaveBeenCalled();
    });

    /**
     * The object is in R2 before the row exists, so a failed create leaves it
     * orphaned. Cleaning up here closes the common case.
     */
    it("removes the uploaded object when the create fails", async () => {
      createItemQueryMock.mockRejectedValue(new Error("connection refused"));

      const result = await createItem(upload);

      expect(result.success).toBe(false);
      expect(deleteObjectQuietlyMock).toHaveBeenCalledWith("user_1/abc123.png");
    });

    it("does not clean up after a successful create", async () => {
      await createItem(upload);

      expect(deleteObjectQuietlyMock).not.toHaveBeenCalled();
    });

    it("reports the create failure, not a cleanup problem", async () => {
      createItemQueryMock.mockRejectedValue(new Error("connection refused"));

      const result = await createItem(upload);

      // The user needs to hear that the item wasn't created; the orphaned
      // object is our problem, not theirs.
      expect(result.error).toBe("Something went wrong. Please try again.");
    });
  });

  it("keeps the url for a link and drops its content", async () => {
    await createItem({
      itemTypeId: "type_link",
      title: "t",
      url: "https://example.com",
      content: "should not be stored",
    });

    const data = createItemQueryMock.mock.calls[0][1];
    expect(data).toHaveProperty("url", "https://example.com");
    expect(data).not.toHaveProperty("content");
  });

  it("requires a url for a link", async () => {
    const result = await createItem({ itemTypeId: "type_link", title: "t" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("URL is required for links.");
    expect(createItemQueryMock).not.toHaveBeenCalled();
  });

  it("does not require a url for types that have no url", async () => {
    const result = await createItem({ itemTypeId: "type_note", title: "t" });

    expect(result.success).toBe(true);
  });

  it("never hands the client a database error message", async () => {
    createItemQueryMock.mockRejectedValue(
      new Error("relation \"Item\" does not exist"),
    );

    const result = await createItem({
      itemTypeId: "type_snippet",
      title: "t",
    });

    expect(result).toEqual({
      success: false,
      error: "Something went wrong. Please try again.",
    });
  });
});
