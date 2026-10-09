import { describe, expect, it } from "vitest";

import {
  acceptAttribute,
  DEFAULT_MIME_TYPE,
  fileExtension,
  fileUrlForKey,
  isPreviewableImage,
  mimeTypeForFileName,
  UPLOAD_RULES,
  uploadKindFor,
  validateUpload,
} from "./uploads";

const MB = 1024 * 1024;

/** A valid candidate, so each test can vary exactly one thing. */
function candidate(overrides: Partial<Parameters<typeof validateUpload>[0]> = {}) {
  return {
    typeName: "file",
    fileName: "notes.md",
    size: 1024,
    mimeType: "text/markdown",
    ...overrides,
  };
}

describe("fileExtension", () => {
  it("lowercases the extension", () => {
    expect(fileExtension("PHOTO.PNG")).toBe(".png");
  });

  it("takes only the final segment of a multi-part extension", () => {
    expect(fileExtension("archive.tar.gz")).toBe(".gz");
  });

  it("ignores directory components in a path-like name", () => {
    expect(fileExtension("some/dir/report.pdf")).toBe(".pdf");
    expect(fileExtension("c:\\windows\\notes.txt")).toBe(".txt");
  });

  it("treats a leading dot as naming the file, not describing it", () => {
    // `.env` is a filename, not an "env-typed" file — so it has no extension
    // and is refused by the rules rather than silently accepted.
    expect(fileExtension(".env")).toBe("");
  });

  it("returns an empty string when there is no extension", () => {
    expect(fileExtension("Makefile")).toBe("");
    expect(fileExtension("")).toBe("");
  });
});

describe("uploadKindFor", () => {
  it("maps the two upload types to their rules", () => {
    expect(uploadKindFor("image")).toBe("image");
    expect(uploadKindFor("file")).toBe("file");
  });

  it("returns null for the text types", () => {
    for (const name of ["snippet", "prompt", "command", "note", "link"]) {
      expect(uploadKindFor(name)).toBeNull();
    }
  });

  it("returns null for an unknown type rather than guessing", () => {
    expect(uploadKindFor("custom-thing")).toBeNull();
  });
});

describe("validateUpload — extensions", () => {
  it("accepts every extension the spec lists for files", () => {
    for (const extension of UPLOAD_RULES.file.extensions) {
      const result = validateUpload(
        candidate({ fileName: `doc${extension}`, mimeType: "" }),
      );
      expect(result.ok, extension).toBe(true);
    }
  });

  it("accepts every extension the spec lists for images", () => {
    for (const extension of UPLOAD_RULES.image.extensions) {
      const result = validateUpload(
        candidate({ typeName: "image", fileName: `pic${extension}`, mimeType: "" }),
      );
      expect(result.ok, extension).toBe(true);
    }
  });

  it("is case-insensitive about the extension", () => {
    expect(validateUpload(candidate({ fileName: "README.MD" })).ok).toBe(true);
  });

  it("refuses an extension from the other kind's list", () => {
    // A .png is a perfectly good upload — just not as a `file` item.
    const result = validateUpload(candidate({ fileName: "pic.png", mimeType: "" }));
    expect(result.ok).toBe(false);
  });

  it("refuses an executable extension outright", () => {
    const result = validateUpload(candidate({ fileName: "payload.exe", mimeType: "" }));
    expect(result).toMatchObject({ ok: false });
  });

  it("refuses a file with no extension at all", () => {
    const result = validateUpload(candidate({ fileName: "Makefile", mimeType: "" }));
    expect(result).toMatchObject({ ok: false });
  });

  it("refuses a blank filename", () => {
    expect(validateUpload(candidate({ fileName: "   " })).ok).toBe(false);
  });
});

describe("validateUpload — size", () => {
  it("accepts a file exactly on the 10 MB limit", () => {
    expect(validateUpload(candidate({ size: 10 * MB })).ok).toBe(true);
  });

  it("refuses a file one byte over the 10 MB limit", () => {
    expect(validateUpload(candidate({ size: 10 * MB + 1 })).ok).toBe(false);
  });

  it("accepts an image exactly on the 5 MB limit", () => {
    const result = validateUpload(
      candidate({ typeName: "image", fileName: "pic.png", mimeType: "image/png", size: 5 * MB }),
    );
    expect(result.ok).toBe(true);
  });

  it("refuses an image one byte over the 5 MB limit", () => {
    const result = validateUpload(
      candidate({ typeName: "image", fileName: "pic.png", mimeType: "image/png", size: 5 * MB + 1 }),
    );
    expect(result.ok).toBe(false);
  });

  it("holds images to the tighter limit than files", () => {
    // 7 MB is fine as a file and too big as an image — the two tiers are real,
    // not one shared ceiling.
    expect(validateUpload(candidate({ size: 7 * MB })).ok).toBe(true);
    expect(
      validateUpload(
        candidate({ typeName: "image", fileName: "pic.png", mimeType: "image/png", size: 7 * MB }),
      ).ok,
    ).toBe(false);
  });

  it("refuses an empty file", () => {
    expect(validateUpload(candidate({ size: 0 })).ok).toBe(false);
  });

  it("refuses a nonsensical size rather than passing it through", () => {
    expect(validateUpload(candidate({ size: -1 })).ok).toBe(false);
    expect(validateUpload(candidate({ size: Number.NaN })).ok).toBe(false);
  });
});

describe("validateUpload — MIME types", () => {
  it("accepts a blank Content-Type, which is what browsers send for .toml", () => {
    // The regression this guards: rejecting on an unrecognised MIME type would
    // refuse perfectly valid .toml/.yaml/.ini/.md uploads.
    for (const fileName of ["config.toml", "docker.yaml", "setup.ini", "notes.md"]) {
      expect(validateUpload(candidate({ fileName, mimeType: "" })).ok, fileName).toBe(true);
    }
  });

  it("accepts a missing or null Content-Type", () => {
    expect(validateUpload(candidate({ mimeType: undefined })).ok).toBe(true);
    expect(validateUpload(candidate({ mimeType: null })).ok).toBe(true);
  });

  it("accepts the generic octet-stream browsers fall back to", () => {
    const result = validateUpload(
      candidate({ fileName: "config.toml", mimeType: "application/octet-stream" }),
    );
    expect(result.ok).toBe(true);
  });

  it("accepts an unlisted but non-contradictory type for a file", () => {
    // `text/x-yaml` isn't in the spec's list, but it doesn't claim to be an
    // image either, so the extension decides.
    expect(validateUpload(candidate({ fileName: "a.yaml", mimeType: "text/x-yaml" })).ok).toBe(true);
  });

  it("refuses a specific type that contradicts the extension's kind", () => {
    expect(validateUpload(candidate({ fileName: "notes.md", mimeType: "image/png" })).ok).toBe(false);
    expect(
      validateUpload(candidate({ typeName: "image", fileName: "pic.png", mimeType: "application/pdf" })).ok,
    ).toBe(false);
  });

  it("is case-insensitive about the Content-Type", () => {
    expect(validateUpload(candidate({ mimeType: "TEXT/MARKDOWN" })).ok).toBe(true);
  });
});

describe("validateUpload — type gating", () => {
  it("refuses an upload for a text item type", () => {
    for (const typeName of ["snippet", "prompt", "command", "note", "link"]) {
      const result = validateUpload(candidate({ typeName }));
      expect(result, typeName).toMatchObject({ ok: false });
    }
  });

  it("reports the kind and extension it resolved on success", () => {
    expect(validateUpload(candidate({ typeName: "image", fileName: "Pic.JPEG", mimeType: "image/jpeg" }))).toEqual({
      ok: true,
      kind: "image",
      extension: ".jpeg",
    });
  });
});

describe("mimeTypeForFileName", () => {
  it("derives the type from the extension, not from any upload header", () => {
    expect(mimeTypeForFileName("pic.png")).toBe("image/png");
    expect(mimeTypeForFileName("doc.pdf")).toBe("application/pdf");
    expect(mimeTypeForFileName("a.svg")).toBe("image/svg+xml");
  });

  it("is case-insensitive", () => {
    expect(mimeTypeForFileName("PIC.PNG")).toBe("image/png");
  });

  it("falls back to a type browsers download rather than render", () => {
    expect(mimeTypeForFileName("mystery")).toBe(DEFAULT_MIME_TYPE);
    expect(mimeTypeForFileName("thing.exe")).toBe(DEFAULT_MIME_TYPE);
  });

  it("covers every extension both rule sets allow", () => {
    // A new allowed extension with no MIME mapping would silently serve as
    // octet-stream, so previews would break — this catches that.
    const all = [...UPLOAD_RULES.image.extensions, ...UPLOAD_RULES.file.extensions];
    for (const extension of all) {
      expect(mimeTypeForFileName(`x${extension}`), extension).not.toBe(DEFAULT_MIME_TYPE);
    }
  });
});

describe("isPreviewableImage", () => {
  it("is true for the image extensions", () => {
    for (const extension of UPLOAD_RULES.image.extensions) {
      expect(isPreviewableImage(`pic${extension}`), extension).toBe(true);
    }
  });

  it("is false for documents and for unknown names", () => {
    expect(isPreviewableImage("doc.pdf")).toBe(false);
    expect(isPreviewableImage("notes.md")).toBe(false);
    expect(isPreviewableImage("mystery")).toBe(false);
  });
});

describe("acceptAttribute", () => {
  it("offers extensions and MIME types together", () => {
    // Some platforms filter the file picker on one, some on the other.
    const accept = acceptAttribute("image");
    expect(accept).toContain(".png");
    expect(accept).toContain("image/png");
  });
});

describe("fileUrlForKey", () => {
  it("points at our own proxy, never at R2", () => {
    // The bucket is private and `Item.fileUrl` holds a key, so a public R2 URL
    // here would be both wrong and a leak.
    expect(fileUrlForKey("user_1/abc.png")).toBe("/api/files/user_1/abc.png");
  });

  it("asks for an attachment when downloading", () => {
    expect(fileUrlForKey("user_1/abc.png", true)).toBe(
      "/api/files/user_1/abc.png?download=1",
    );
  });

  it("encodes each segment without escaping the separator", () => {
    // The path stays two segments, so the route's `[...key]` still splits it
    // back into the same key.
    expect(fileUrlForKey("user 1/a b.png")).toBe("/api/files/user%201/a%20b.png");
  });
});
