import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The AWS SDK is mocked wholesale: these tests cover the key shaping, the
 * not-found handling and the quiet-cleanup contract, none of which should
 * involve a network call. Each command class records the input it was built
 * with so assertions can read the bucket and key that would have been sent.
 */
const sendMock = vi.fn();

class FakeCommand {
  constructor(public readonly input: Record<string, unknown>) {}
}

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = sendMock;
  },
  PutObjectCommand: class extends FakeCommand {},
  GetObjectCommand: class extends FakeCommand {},
  DeleteObjectCommand: class extends FakeCommand {},
}));

const ENV = {
  R2_ACCOUNT_ID: "acct_123",
  R2_ACCESS_KEY_ID: "key_123",
  R2_SECRET_ACCESS_KEY: "secret_123",
  R2_BUCKET_NAME: "devstash-test",
};

/**
 * `src/lib/r2.ts` caches its config and client on first use, so every test gets
 * a fresh module instance — otherwise the first test's env would decide the
 * outcome of all the others.
 */
async function loadR2() {
  vi.resetModules();
  for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
  return import("./r2");
}

function notFound(name = "NoSuchKey") {
  return Object.assign(new Error(name), { name, $metadata: { httpStatusCode: 404 } });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildObjectKey", () => {
  it("prefixes the key with the owner's id", async () => {
    const { buildObjectKey } = await loadR2();

    expect(buildObjectKey("user_1", "photo.png").startsWith("user_1/")).toBe(true);
  });

  it("keeps only the extension, lowercased — never the original name", async () => {
    const { buildObjectKey } = await loadR2();

    const key = buildObjectKey("user_1", "My Holiday Photo.PNG");

    // The real name is kept in `Item.fileName`; keeping it out of the key means
    // nothing has to be sanitised and no two uploads can collide.
    expect(key).not.toContain("Holiday");
    expect(key.endsWith(".png")).toBe(true);
  });

  it("gives two uploads of the same filename different keys", async () => {
    const { buildObjectKey } = await loadR2();

    expect(buildObjectKey("user_1", "screenshot.png")).not.toBe(
      buildObjectKey("user_1", "screenshot.png"),
    );
  });

  it("round-trips through objectKeyOwner", async () => {
    const { buildObjectKey, objectKeyOwner } = await loadR2();

    expect(objectKeyOwner(buildObjectKey("user_42", "a.pdf"))).toBe("user_42");
  });
});

describe("objectKeyOwner", () => {
  it("reads the owner from a well-formed key", async () => {
    const { objectKeyOwner } = await loadR2();

    expect(objectKeyOwner("user_1/abc.png")).toBe("user_1");
  });

  it("rejects keys that aren't exactly one level deep", async () => {
    const { objectKeyOwner } = await loadR2();

    // A traversal attempt or a nested path isn't one of ours, so the proxy's
    // cheap pre-check refuses it before any I/O.
    expect(objectKeyOwner("user_1/nested/abc.png")).toBeNull();
    expect(objectKeyOwner("abc.png")).toBeNull();
    expect(objectKeyOwner("user_1/")).toBeNull();
    expect(objectKeyOwner("/abc.png")).toBeNull();
    expect(objectKeyOwner("")).toBeNull();
  });
});

describe("isStorageConfigured", () => {
  it("is true when all four variables are present", async () => {
    const { isStorageConfigured } = await loadR2();

    expect(isStorageConfigured()).toBe(true);
  });

  it("is false when any one of them is missing", async () => {
    for (const missing of Object.keys(ENV)) {
      vi.resetModules();
      for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
      vi.stubEnv(missing, "");

      const { isStorageConfigured } = await import("./r2");
      expect(isStorageConfigured(), missing).toBe(false);
    }
  });

  it("does not throw at import time when unconfigured", async () => {
    vi.resetModules();
    for (const name of Object.keys(ENV)) vi.stubEnv(name, "");

    // Resolving lazily is what keeps a missing env var from crashing any route
    // that merely imports this module.
    await expect(import("./r2")).resolves.toBeDefined();
  });

  it("throws a named error when an operation is attempted unconfigured", async () => {
    vi.resetModules();
    for (const name of Object.keys(ENV)) vi.stubEnv(name, "");

    const { deleteObject } = await import("./r2");

    await expect(deleteObject("user_1/a.png")).rejects.toThrow(/not configured/i);
  });
});

describe("putObject", () => {
  beforeEach(() => {
    sendMock.mockResolvedValue({});
  });

  it("sends the bucket, key, body and content type", async () => {
    const { putObject } = await loadR2();
    const body = Buffer.from("hello");

    await putObject({ key: "user_1/a.txt", body, contentType: "text/plain" });

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].input).toEqual({
      Bucket: "devstash-test",
      Key: "user_1/a.txt",
      Body: body,
      ContentType: "text/plain",
    });
  });
});

describe("getObject", () => {
  it("returns the bytes and metadata", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    sendMock.mockResolvedValue({
      Body: { transformToByteArray: async () => bytes },
      ContentType: "image/png",
      ContentLength: 3,
    });

    const { getObject } = await loadR2();

    expect(await getObject("user_1/a.png")).toEqual({
      body: bytes,
      contentType: "image/png",
      contentLength: 3,
    });
  });

  it("returns null for a missing key instead of throwing", async () => {
    sendMock.mockRejectedValue(notFound());

    const { getObject } = await loadR2();

    expect(await getObject("user_1/gone.png")).toBeNull();
  });

  it("returns null when the response carries no body", async () => {
    sendMock.mockResolvedValue({ Body: undefined });

    const { getObject } = await loadR2();

    expect(await getObject("user_1/a.png")).toBeNull();
  });

  it("rethrows a real failure rather than reporting it as missing", async () => {
    // A credentials or network error must not be mistaken for "no such file",
    // which the route would turn into a misleading 404.
    sendMock.mockRejectedValue(
      Object.assign(new Error("Access Denied"), {
        name: "AccessDenied",
        $metadata: { httpStatusCode: 403 },
      }),
    );

    const { getObject } = await loadR2();

    await expect(getObject("user_1/a.png")).rejects.toThrow("Access Denied");
  });
});

describe("deleteObject", () => {
  it("resolves true when the object was removed", async () => {
    sendMock.mockResolvedValue({});

    const { deleteObject } = await loadR2();

    expect(await deleteObject("user_1/a.png")).toBe(true);
    expect(sendMock.mock.calls[0][0].input).toEqual({
      Bucket: "devstash-test",
      Key: "user_1/a.png",
    });
  });

  it("resolves false when it was already gone, so cleanup is idempotent", async () => {
    sendMock.mockRejectedValue(notFound("NotFound"));

    const { deleteObject } = await loadR2();

    expect(await deleteObject("user_1/gone.png")).toBe(false);
  });

  it("rethrows a real failure", async () => {
    sendMock.mockRejectedValue(new Error("network down"));

    const { deleteObject } = await loadR2();

    await expect(deleteObject("user_1/a.png")).rejects.toThrow("network down");
  });
});

describe("deleteObjectQuietly", () => {
  it("swallows a storage failure so the caller's outcome is unaffected", async () => {
    // Used after a row is already deleted, and after a failed create — in both
    // cases the object is orphaned either way, and the user's result must not
    // depend on R2 being reachable.
    sendMock.mockRejectedValue(new Error("network down"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const { deleteObjectQuietly } = await loadR2();

    await expect(deleteObjectQuietly("user_1/a.png")).resolves.toBeUndefined();
    // Silent leaks are worse than loud ones.
    expect(logged).toHaveBeenCalled();
  });

  it("still deletes on the happy path", async () => {
    sendMock.mockResolvedValue({});

    const { deleteObjectQuietly } = await loadR2();

    await deleteObjectQuietly("user_1/a.png");

    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});
