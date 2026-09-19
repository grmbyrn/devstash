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

const { createItem, deleteItem, updateItem } = await import("./items");

/** The system types the create action resolves `itemTypeId` against. */
const SYSTEM_TYPES = [
  { id: "type_snippet", name: "snippet", icon: "Code", color: "#3b82f6" },
  { id: "type_note", name: "note", icon: "StickyNote", color: "#fde047" },
  { id: "type_link", name: "link", icon: "Link", color: "#10b981" },
  { id: "type_file", name: "file", icon: "File", color: "#6b7280" },
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
    deleteItemQueryMock.mockResolvedValue(true);
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
    deleteItemQueryMock.mockResolvedValue(false);

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

  it("refuses an upload-backed type, which has no file to point at", async () => {
    const result = await createItem({ itemTypeId: "type_file", title: "t" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Choose an item type.");
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
