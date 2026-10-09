import { beforeEach, describe, expect, it, vi } from "vitest";

// `@/auth` pulls in next-auth, which will not resolve outside the Next runtime.
const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: authMock }));

const putObjectMock = vi.fn();
const buildObjectKeyMock = vi.fn();
const isStorageConfiguredMock = vi.fn();
vi.mock("@/lib/r2", () => ({
  putObject: putObjectMock,
  buildObjectKey: buildObjectKeyMock,
  isStorageConfigured: isStorageConfiguredMock,
}));

const { POST } = await import("./route");

/** A multipart request carrying one file, as the browser would send it. */
function uploadRequest({
  name = "notes.md",
  type = "text/markdown",
  bytes = "# hello" as BlobPart,
  itemType = "file",
  omitFile = false,
  omitType = false,
}: {
  name?: string;
  type?: string;
  bytes?: BlobPart;
  itemType?: string;
  omitFile?: boolean;
  omitType?: boolean;
} = {}) {
  const form = new FormData();
  if (!omitFile) form.append("file", new File([bytes], name, { type }));
  if (!omitType) form.append("type", itemType);
  return new Request("http://localhost/api/upload", { method: "POST", body: form });
}

describe("POST /api/upload", () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ user: { id: "user_1" } });
    isStorageConfiguredMock.mockReturnValue(true);
    buildObjectKeyMock.mockReturnValue("user_1/generated.md");
    putObjectMock.mockResolvedValue(undefined);
  });

  it("stores the file and returns its key, name and size", async () => {
    const response = await POST(uploadRequest({ bytes: "# hello" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: { key: "user_1/generated.md", fileName: "notes.md", fileSize: 7 },
    });
  });

  it("builds the key from the session user id, never from the request", async () => {
    await POST(uploadRequest());

    expect(buildObjectKeyMock).toHaveBeenCalledWith("user_1", "notes.md");
  });

  it("stores a content type derived from the extension, not the upload header", async () => {
    // A client claiming `text/html` for a .md file must not get that echoed
    // back to a future viewer's browser.
    await POST(uploadRequest({ name: "notes.md", type: "text/html" }));

    expect(putObjectMock).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "text/markdown; charset=utf-8" }),
    );
  });

  it("rejects an unauthenticated request without touching storage", async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(uploadRequest());

    expect(response.status).toBe(401);
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it("reports unconfigured storage as a server problem, not a bad request", async () => {
    isStorageConfiguredMock.mockReturnValue(false);

    const response = await POST(uploadRequest());

    expect(response.status).toBe(503);
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it("rejects a request with no file", async () => {
    const response = await POST(uploadRequest({ omitFile: true }));

    expect(response.status).toBe(400);
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it("rejects a request with no item type", async () => {
    const response = await POST(uploadRequest({ omitType: true }));

    expect(response.status).toBe(400);
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it("rejects a body that isn't multipart form data", async () => {
    const response = await POST(
      new Request("http://localhost/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(400);
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it("refuses a disallowed extension before storing anything", async () => {
    const response = await POST(uploadRequest({ name: "payload.exe", type: "" }));

    expect(response.status).toBe(400);
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it("refuses an image extension submitted as a file item", async () => {
    const response = await POST(
      uploadRequest({ name: "pic.png", type: "image/png", itemType: "file" }),
    );

    expect(response.status).toBe(400);
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it("refuses an upload for a text item type", async () => {
    const response = await POST(uploadRequest({ itemType: "snippet" }));

    expect(response.status).toBe(400);
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it("enforces the size limit on the real bytes", async () => {
    // 10 MB + 1 as an actual payload, not a claimed size.
    const oversized = new Uint8Array(10 * 1024 * 1024 + 1);

    const response = await POST(uploadRequest({ name: "big.pdf", type: "application/pdf", bytes: oversized }));

    expect(response.status).toBe(400);
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it("holds an image to the tighter 5 MB limit", async () => {
    const sixMb = new Uint8Array(6 * 1024 * 1024);

    const response = await POST(
      uploadRequest({ name: "pic.png", type: "image/png", itemType: "image", bytes: sixMb }),
    );

    expect(response.status).toBe(400);
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it("reports the byte count it actually received", async () => {
    // The size written to the item is the length of the bytes the handler read,
    // which is also the number the limit is checked against — so the stored
    // value and the validated value can never be two different things.
    const response = await POST(uploadRequest({ bytes: "0123456789" }));

    expect((await response.json()).data.fileSize).toBe(10);
  });

  it("accepts a file whose browser Content-Type is blank", async () => {
    // Browsers routinely send nothing for .toml — this is the regression that
    // would otherwise refuse a valid upload.
    const response = await POST(uploadRequest({ name: "config.toml", type: "" }));

    expect(response.status).toBe(200);
    expect(putObjectMock).toHaveBeenCalled();
  });

  it("never leaks a storage error message to the client", async () => {
    putObjectMock.mockRejectedValue(new Error("AccessDenied: bucket devstash-prod"));

    const response = await POST(uploadRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("devstash-prod");
    expect(body.success).toBe(false);
  });
});
