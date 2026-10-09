/**
 * Upload constraints for the `file` and `image` item types.
 *
 * This module is deliberately free of I/O: it decides whether a given name,
 * size and reported MIME type are acceptable, and nothing else. The upload
 * route applies it to the real bytes, the `FileUpload` component applies the
 * same rules in the browser for immediate feedback, and the rules themselves
 * are unit-tested without touching R2.
 */

/** The two item types whose body is an uploaded object rather than text. */
export type UploadKind = "image" | "file";

export interface UploadRules {
  /** Hard size ceiling in bytes. */
  maxBytes: number;
  /** Permitted extensions, lowercase and dot-prefixed. */
  extensions: readonly string[];
  /**
   * MIME types we recognise. Used as a *secondary* signal only — see
   * {@link validateUpload} for why a mismatch is not fatal.
   */
  mimeTypes: readonly string[];
}

const MB = 1024 * 1024;

export const UPLOAD_RULES = {
  image: {
    maxBytes: 5 * MB,
    extensions: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"],
    mimeTypes: [
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ],
  },
  file: {
    maxBytes: 10 * MB,
    extensions: [
      ".pdf",
      ".txt",
      ".md",
      ".json",
      ".yaml",
      ".yml",
      ".xml",
      ".csv",
      ".toml",
      ".ini",
    ],
    mimeTypes: [
      "application/pdf",
      "text/plain",
      "text/markdown",
      "application/json",
      "application/x-yaml",
      "text/yaml",
      "application/xml",
      "text/xml",
      "text/csv",
      "application/toml",
    ],
  },
} as const satisfies Record<UploadKind, UploadRules>;

/** The item type names that take an upload, mapped to their rule set. */
const KIND_BY_TYPE_NAME: Record<string, UploadKind> = {
  image: "image",
  file: "file",
};

/** The upload kind for an item type name, or null for the text types. */
export function uploadKindFor(typeName: string): UploadKind | null {
  return KIND_BY_TYPE_NAME[typeName] ?? null;
}

/**
 * The lowercase, dot-prefixed extension of a filename, or `""` if it has none.
 *
 * Only the final segment counts, so `archive.tar.gz` is `.gz` and a dotfile
 * like `.env` is treated as having no extension rather than being `.env` — a
 * leading dot names the file, it doesn't describe its type.
 */
export function fileExtension(fileName: string): string {
  const base = fileName.trim().split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot).toLowerCase();
}

/**
 * The `accept` attribute for a file input of this kind — extensions *and* MIME
 * types, since some platforms filter on one and some on the other.
 */
export function acceptAttribute(kind: UploadKind): string {
  const rules = UPLOAD_RULES[kind];
  return [...rules.extensions, ...rules.mimeTypes].join(",");
}

/**
 * The MIME type to *serve* a stored object as, derived from its extension.
 *
 * Deliberately derived rather than remembered: the Content-Type a browser sent
 * at upload time is client-supplied, so echoing it back would let an uploader
 * choose how their bytes are interpreted by someone else's browser. Mapping
 * from the extension — which the rules already constrained to a known list —
 * means the response type is always one we picked.
 *
 * Anything unrecognised falls back to `application/octet-stream`, which browsers
 * download rather than render.
 */
const MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".yaml": "text/yaml; charset=utf-8",
  ".yml": "text/yaml; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".toml": "text/plain; charset=utf-8",
  ".ini": "text/plain; charset=utf-8",
};

export const DEFAULT_MIME_TYPE = "application/octet-stream";

export function mimeTypeForFileName(fileName: string): string {
  return MIME_BY_EXTENSION[fileExtension(fileName)] ?? DEFAULT_MIME_TYPE;
}

/**
 * Whether an extension is permitted for a kind.
 *
 * Exported so the create action can check a stored object's key against the
 * item type it is being attached to: the upload route validated the extension
 * for the type it was uploaded *as*, which is not necessarily the type the item
 * ends up being.
 */
export function isExtensionAllowed(
  kind: UploadKind,
  extension: string,
): boolean {
  return UPLOAD_RULES[kind].extensions.includes(extension.toLowerCase() as never);
}

/** Whether a stored object can be rendered inline as an image preview. */
export function isPreviewableImage(fileName: string): boolean {
  return UPLOAD_RULES.image.extensions.includes(fileExtension(fileName) as never);
}

/**
 * The URL to read a stored object back through.
 *
 * Always our own proxy, never R2 directly: `Item.fileUrl` holds the object key
 * and the bucket is private, so this route is the only way an upload is read.
 * `download` asks for an attachment disposition rather than inline rendering.
 *
 * Each segment is encoded so a key never has to be trusted as a URL path.
 */
export function fileUrlForKey(key: string, download = false): string {
  const path = key.split("/").map(encodeURIComponent).join("/");
  return `/api/files/${path}${download ? "?download=1" : ""}`;
}

export type UploadValidation =
  | { ok: true; kind: UploadKind; extension: string }
  | { ok: false; error: string };

export interface UploadCandidate {
  /** The item type name the upload is for (`"file"` or `"image"`). */
  typeName: string;
  fileName: string;
  size: number;
  /** The browser-reported Content-Type. Often empty or generic — see below. */
  mimeType?: string | null;
}

/**
 * Whether an upload is allowed.
 *
 * **Extension is the rule; MIME is only a cross-check.** Browsers routinely
 * report an empty string or `application/octet-stream` for `.toml`, `.yaml`,
 * `.md` and `.ini`, so rejecting on an unrecognised MIME type would refuse
 * perfectly valid uploads. A MIME type is therefore only fatal when it is
 * present, specific, and names a *different* kind than the extension does —
 * e.g. a file called `notes.md` arriving as `image/png`.
 *
 * Neither signal proves what the bytes actually are; both are supplied by the
 * client. What keeps that from mattering is that objects are stored privately
 * and served back through a proxy that sets the response type itself, never
 * echoing what was uploaded.
 */
export function validateUpload(candidate: UploadCandidate): UploadValidation {
  const kind = uploadKindFor(candidate.typeName);
  if (!kind) {
    return { ok: false, error: "This item type does not take an upload." };
  }

  const rules = UPLOAD_RULES[kind];
  const name = candidate.fileName.trim();

  if (name.length === 0) {
    return { ok: false, error: "The file needs a name." };
  }

  const extension = fileExtension(name);
  if (!extension) {
    return {
      ok: false,
      error: `${labelFor(kind)} needs a file extension (${listExtensions(kind)}).`,
    };
  }

  if (!rules.extensions.includes(extension as never)) {
    return {
      ok: false,
      error: `${extension} files aren't supported. Use ${listExtensions(kind)}.`,
    };
  }

  if (!Number.isFinite(candidate.size) || candidate.size <= 0) {
    return { ok: false, error: "That file is empty." };
  }

  if (candidate.size > rules.maxBytes) {
    return {
      ok: false,
      error: `${labelFor(kind)} must be ${formatLimit(rules.maxBytes)} or smaller.`,
    };
  }

  // A specific MIME type that contradicts the extension's kind is refused; a
  // blank or generic one is not, because that is what browsers often send.
  const mime = candidate.mimeType?.trim().toLowerCase();
  if (mime && !isGenericMime(mime) && contradictsKind(mime, kind)) {
    return { ok: false, error: `That doesn't look like ${article(kind)}.` };
  }

  return { ok: true, kind, extension };
}

/** MIME types that carry no information and so can't contradict anything. */
function isGenericMime(mime: string): boolean {
  return (
    mime === "application/octet-stream" ||
    mime === "application/x-empty" ||
    mime === "binary/octet-stream"
  );
}

/**
 * True when a specific MIME type names the wrong kind of thing. Anything the
 * rules don't list is only rejected if it clearly belongs to the other kind —
 * an unknown `application/*` on a `.toml` is tolerated, an `image/*` on a
 * `.pdf` is not.
 */
function contradictsKind(mime: string, kind: UploadKind): boolean {
  if (UPLOAD_RULES[kind].mimeTypes.includes(mime as never)) return false;
  const isImageMime = mime.startsWith("image/");
  return kind === "image" ? !isImageMime : isImageMime;
}

function labelFor(kind: UploadKind): string {
  return kind === "image" ? "Images" : "Files";
}

function article(kind: UploadKind): string {
  return kind === "image" ? "an image" : "a supported file";
}

function listExtensions(kind: UploadKind): string {
  return UPLOAD_RULES[kind].extensions.join(", ");
}

/** "5 MB" / "10 MB" for an error message, without a trailing `.0`. */
function formatLimit(bytes: number): string {
  return `${Math.round(bytes / MB)} MB`;
}
