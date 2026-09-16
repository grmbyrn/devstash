import { beforeEach, describe, expect, it, vi } from "vitest";

// `@/auth` pulls in next-auth, which will not resolve outside the Next runtime,
// so it is replaced wholesale — the route only ever calls `auth()`.
const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: authMock }));

const getItemByIdMock = vi.fn();
vi.mock("@/lib/db/items", () => ({ getItemById: getItemByIdMock }));

const { GET } = await import("./route");

const request = new Request("http://localhost/api/items/item_1");
const params = (id: string) => ({ params: Promise.resolve({ id }) });

const detail = {
  id: "item_1",
  title: "useDebounce",
  content: "export function useDebounce() {}",
  tags: ["react"],
  collections: [{ id: "col_1", name: "React Patterns" }],
};

describe("GET /api/items/[id]", () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ user: { id: "user_1" } });
    getItemByIdMock.mockResolvedValue(detail);
  });

  it("returns the item for its owner", async () => {
    const response = await GET(request, params("item_1"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: detail });
  });

  it("passes the session user id to the query, never a client-supplied one", async () => {
    await GET(request, params("item_1"));

    expect(getItemByIdMock).toHaveBeenCalledWith("user_1", "item_1");
  });

  it("rejects an unauthenticated request without touching the database", async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(request, params("item_1"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      error: "Unauthorized",
    });
    expect(getItemByIdMock).not.toHaveBeenCalled();
  });

  it("rejects a session with no user id", async () => {
    authMock.mockResolvedValue({ user: { email: "someone@example.com" } });

    expect((await GET(request, params("item_1"))).status).toBe(401);
    expect(getItemByIdMock).not.toHaveBeenCalled();
  });

  it("answers 404 — not 403 — for an item the user does not own", async () => {
    // The query is user-scoped, so someone else's item comes back as null and
    // is indistinguishable from an id that was never there. That is the point:
    // the response must not reveal which ids exist.
    getItemByIdMock.mockResolvedValue(null);

    const response = await GET(request, params("someone_elses_item"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      error: "Item not found",
    });
  });

  it("answers an unknown id exactly as it answers another user's item", async () => {
    getItemByIdMock.mockResolvedValue(null);
    const missing = await GET(request, params("does_not_exist"));
    const foreign = await GET(request, params("someone_elses_item"));

    expect(missing.status).toBe(foreign.status);
    expect(await missing.json()).toEqual(await foreign.json());
  });

  it("does not leak internals when the query throws", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    getItemByIdMock.mockRejectedValue(new Error("connection terminated"));

    const response = await GET(request, params("item_1"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).not.toContain("connection terminated");
    consoleError.mockRestore();
  });
});
