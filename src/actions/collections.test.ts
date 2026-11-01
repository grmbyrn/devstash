import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const createCollectionQueryMock = vi.fn();

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db/collections", () => ({
  createCollection: createCollectionQueryMock,
}));

const { createCollection } = await import("./collections");

const SESSION = { user: { id: "user_1" } };
const created = { id: "col_1", name: "React Patterns", description: null };

describe("createCollection action", () => {
  beforeEach(() => {
    authMock.mockResolvedValue(SESSION);
    createCollectionQueryMock.mockResolvedValue(created);
  });

  it("creates a valid collection and returns it", async () => {
    const result = await createCollection({ name: "React Patterns" });

    expect(result).toEqual({ success: true, data: created });
  });

  it("creates under the session's user id, not anything from the caller", async () => {
    await createCollection({
      name: " React Patterns ",
      description: "Hooks",
      userId: "user_999",
    });

    expect(createCollectionQueryMock).toHaveBeenCalledWith("user_1", {
      name: "React Patterns",
      description: "Hooks",
    });
  });

  it("refuses when there is no session, without touching the database", async () => {
    authMock.mockResolvedValue(null);

    const result = await createCollection({ name: "n" });

    expect(result.success).toBe(false);
    expect(createCollectionQueryMock).not.toHaveBeenCalled();
  });

  it("returns the validation message and writes nothing on bad input", async () => {
    const result = await createCollection({ name: "   " });

    expect(result).toEqual({ success: false, error: "Name is required" });
    expect(createCollectionQueryMock).not.toHaveBeenCalled();
  });

  it("never hands the client a database error message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    createCollectionQueryMock.mockRejectedValue(
      new Error("connection to db.internal:5432 refused"),
    );

    const result = await createCollection({ name: "n" });

    expect(result).toEqual({
      success: false,
      error: "Something went wrong. Please try again.",
    });
  });
});
