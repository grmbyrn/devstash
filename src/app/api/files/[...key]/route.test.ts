import { beforeEach, describe, expect, it, vi } from "vitest";

// `@/auth` pulls in next-auth, which will not resolve outside the Next runtime.
const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: authMock }));

const getItemByFileKeyMock = vi.fn();
vi.mock("@/lib/db/items", () => ({ getItemByFileKey: getItemByFileKeyMock }));

const getObjectMock = vi.fn();
const isStorageConfiguredMock = vi.fn();
vi.mock("@/lib/r2", async () => {
  // `objectKeyOwner` is pure and is part of what this route's behaviour is, so
  // the real one is kept rather than stubbed.
  const actual = await vi.importActual<typeof import("@/lib/r2")>("@/lib/r2");
  return {
    objectKeyOwner: actual.objectKeyOwner,
    getObject: getObjectMock,
    isStorageConfigured: isStorageConfiguredMock,
  };
});

const { GET } = await import("./route");

const OWN_KEY = "user_1/abc123.png";

function request(key = OWN_KEY, query = "") {
  return new Request(`http://localhost/api/files/${key}${query}`);
}

function params(key: string) {
  return { params: Promise.resolve({ key: key.split("/") }) };
}

const bytes = new Uint8Array([137, 80, 78, 71]);

describe("GET /api/files/[...key]", () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ user: { id: "user_1" } });
    isStorageConfiguredMock.mockReturnValue(true);
    getItemByFileKeyMock.mockResolvedValue({ id: "item_1", fileName: "pic.png" });
    getObjectMock.mockResolvedValue({
      body: bytes,
      contentType: "image/png",
      contentLength: bytes.byteLength,
    });
  });

  it("serves the object to the owner", async () => {
    const response = await GET(request(), params(OWN_KEY));

    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    expect(response.headers.get("Content-Length")).toBe("4");
  });

  it("authorises against the session user id, never the key's own claim", async () => {
    await GET(request(), params(OWN_KEY));

    expect(getItemByFileKeyMock).toHaveBeenCalledWith("user_1", OWN_KEY);
  });

  it("rejects an unauthenticated request without touching storage", async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(request(), params(OWN_KEY));

    expect(response.status).toBe(401);
    expect(getObjectMock).not.toHaveBeenCalled();
  });

  it("404s another user's key without reading the bucket", async () => {
    // The prefix check short-circuits before any I/O — possession of a key
    // proves nothing.
    const foreign = "user_2/abc123.png";

    const response = await GET(request(foreign), params(foreign));

    expect(response.status).toBe(404);
    expect(getObjectMock).not.toHaveBeenCalled();
    expect(getItemByFileKeyMock).not.toHaveBeenCalled();
  });

  it("404s a key no item of the user's points at", async () => {
    getItemByFileKeyMock.mockResolvedValue(null);

    const response = await GET(request(), params(OWN_KEY));

    expect(response.status).toBe(404);
    expect(getObjectMock).not.toHaveBeenCalled();
  });

  it("answers a foreign key and an unknown key identically", async () => {
    const foreign = "user_2/abc123.png";
    const foreignResponse = await GET(request(foreign), params(foreign));

    getItemByFileKeyMock.mockResolvedValue(null);
    const unknownResponse = await GET(request(), params(OWN_KEY));

    // Byte-identical, so the route can't be used to probe which objects exist.
    expect(foreignResponse.status).toBe(unknownResponse.status);
    expect(await foreignResponse.text()).toBe(await unknownResponse.text());
  });

  it("rejects a path that isn't shaped like one of our keys", async () => {
    for (const key of ["user_1/nested/a.png", "a.png"]) {
      const response = await GET(request(key), params(key));
      expect(response.status, key).toBe(404);
    }
  });

  it("404s when the row survived but the object is gone", async () => {
    getObjectMock.mockResolvedValue(null);

    const response = await GET(request(), params(OWN_KEY));

    expect(response.status).toBe(404);
  });

  it("reports unconfigured storage as a server problem", async () => {
    isStorageConfiguredMock.mockReturnValue(false);

    const response = await GET(request(), params(OWN_KEY));

    expect(response.status).toBe(503);
  });

  describe("response headers", () => {
    it("derives the content type from the object key, not the stored object", async () => {
      // The object's own ContentType came from an upload header, so it is never
      // echoed back.
      getObjectMock.mockResolvedValue({ body: bytes, contentType: "text/html", contentLength: 4 });

      const response = await GET(request(), params(OWN_KEY));

      expect(response.headers.get("Content-Type")).toBe("image/png");
    });

    /**
     * The key's extension is server-generated and was validated at upload; the
     * display name is client-supplied and never was. Deriving the served type
     * from the name would let an uploader decide how their own bytes are
     * interpreted — e.g. serving a PDF object as `image/svg+xml`.
     */
    it("ignores a display name that disagrees with the key", async () => {
      getItemByFileKeyMock.mockResolvedValue({ id: "item_1", fileName: "spoof.svg" });

      const response = await GET(request(), params(OWN_KEY));

      expect(response.headers.get("Content-Type")).toBe("image/png");
    });

    it("falls back to octet-stream for a key with no known extension", async () => {
      const odd = "user_1/abc123";
      getItemByFileKeyMock.mockResolvedValue({ id: "item_1", fileName: null });

      const response = await GET(request(odd), params(odd));

      expect(response.headers.get("Content-Type")).toBe("application/octet-stream");
    });

    it("sends an inline disposition by default, so previews render", async () => {
      const response = await GET(request(), params(OWN_KEY));

      expect(response.headers.get("Content-Disposition")).toMatch(/^inline;/);
    });

    it("sends an attachment disposition for ?download=1", async () => {
      const response = await GET(request(OWN_KEY, "?download=1"), params(OWN_KEY));

      expect(response.headers.get("Content-Disposition")).toMatch(/^attachment;/);
    });

    it("carries the original filename in both header forms", async () => {
      getItemByFileKeyMock.mockResolvedValue({ id: "item_1", fileName: "my photo.png" });

      const header = (await GET(request(), params(OWN_KEY))).headers.get(
        "Content-Disposition",
      );

      expect(header).toContain('filename="my photo.png"');
      expect(header).toContain("filename*=UTF-8''my%20photo.png");
    });

    it("strips quotes and separators from the ASCII filename", async () => {
      // A crafted name must not be able to close the quoted string and append
      // its own header parameters.
      getItemByFileKeyMock.mockResolvedValue({
        id: "item_1",
        fileName: 'evil".png',
      });

      const header = (await GET(request(), params(OWN_KEY))).headers.get(
        "Content-Disposition",
      )!;

      expect(header).toContain('filename="evil.png"');
      // Exactly the two parameters we send, and no injected third.
      expect(header.split(";").length).toBe(3);
    });

    it("blocks script execution for uploaded SVG and PDF", async () => {
      // SVG is executable markup, so an image item opened directly could
      // otherwise run script in our own origin.
      getItemByFileKeyMock.mockResolvedValue({ id: "item_1", fileName: "logo.svg" });

      const response = await GET(request(), params(OWN_KEY));

      expect(response.headers.get("Content-Security-Policy")).toContain("sandbox");
      expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });

    it("marks the response private so no shared cache keeps it", async () => {
      const cacheControl = response_cacheControl(
        await GET(request(), params(OWN_KEY)),
      );

      expect(cacheControl).toContain("private");
      expect(cacheControl).not.toContain("public");
    });
  });

  it("never leaks a storage error message to the client", async () => {
    getObjectMock.mockRejectedValue(new Error("AccessDenied: bucket devstash-prod"));

    const response = await GET(request(), params(OWN_KEY));
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).not.toContain("devstash-prod");
  });
});

function response_cacheControl(response: Response): string {
  return response.headers.get("Cache-Control") ?? "";
}
