import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const updateItemQueryMock = vi.fn();
const deleteItemQueryMock = vi.fn();

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db/items", () => ({
  updateItem: updateItemQueryMock,
  deleteItem: deleteItemQueryMock,
}));

const { deleteItem, updateItem } = await import("./items");

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
