import { z } from "zod";

/** Upper bound on tags per item, so a paste can't write unbounded rows. */
export const MAX_TAGS = 25;

/**
 * Ceiling for the reported `fileSize`, matching the largest upload tier (the
 * 10 MB file type). The per-kind limits are enforced against the real bytes in
 * `src/lib/uploads.ts`; this is only a sanity bound on a client-reported
 * number, so one value for both kinds is enough.
 */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * An optional, nullable text field.
 *
 * Three input states are kept distinct, because they mean different things to
 * an update:
 *
 * - `undefined` (absent from the payload) — leave the column alone. The drawer
 *   only sends the fields editable for that item's type, so a snippet's save
 *   must not wipe a `url` it never showed.
 * - `null` or empty/whitespace — the user cleared the field; write `null`.
 * - text — trimmed, then written.
 */
const nullableText = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    const trimmed = (value ?? "").trim();
    return trimmed.length > 0 ? trimmed : null;
  });

/**
 * Same three states as `nullableText`, but a non-empty value must parse as a
 * URL. Validated after the transform so the check runs against the trimmed
 * string and a cleared field is still allowed through as `null`.
 */
const nullableUrl = nullableText.refine(
  (value) => value === undefined || value === null || z.url().safeParse(value).success,
  { message: "Enter a valid URL" },
);

/** A capped, deduplicated list of tag names. Shared by create and update. */
const tagList = z
  .array(z.string().trim().min(1, "Tags cannot be empty"))
  .max(MAX_TAGS, `Use at most ${MAX_TAGS} tags`)
  // Tag rows are unique by name, so a duplicate in one payload would collide
  // on insert. Dedupe case-insensitively, keeping the first spelling.
  .transform((tags) => {
    const seen = new Set<string>();
    return tags.filter((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })
  .optional();

/** The title rule, identical on create and update. */
const itemTitle = z
  .string()
  .trim()
  .min(1, "Title is required")
  .max(200, "Title is too long");

/**
 * Payload for `updateItem`. Every field except `title` is optional so a partial
 * save touches only what it sends.
 */
export const updateItemSchema = z.object({
  title: itemTitle,
  description: nullableText,
  content: nullableText,
  language: nullableText,
  url: nullableUrl,
  tags: tagList,
});

export type UpdateItemInput = z.infer<typeof updateItemSchema>;

/**
 * Payload for `createItem`.
 *
 * Shaped like the update payload with `itemTypeId` added, but the optional
 * fields mean something simpler here: there is no existing row to leave alone,
 * so an absent field and a cleared one both end up unset.
 *
 * Note what this deliberately does *not* check: whether `itemTypeId` names a
 * real type, and whether the fields sent make sense for it. Both need the type
 * row, so they live in the action — which resolves the id against the actual
 * system types rather than trusting the client's word for it.
 */
export const createItemSchema = z.object({
  // The custom message covers a missing id as well as a blank one — both mean
  // the same thing to the user, and Zod's default ("expected string, received
  // undefined") would otherwise reach a toast.
  itemTypeId: z
    .string({ error: "Choose an item type" })
    .trim()
    .min(1, "Choose an item type"),
  title: itemTitle,
  description: nullableText,
  content: nullableText,
  language: nullableText,
  url: nullableUrl,
  tags: tagList,
  // ── Upload fields, for the file and image types ──────────────────────────
  //
  // These describe an object the upload route has *already* stored, so they are
  // reported by the client rather than chosen by it. None of them is trusted
  // for authorisation: the action re-derives ownership from the session and the
  // key's own prefix, and a key naming someone else's prefix is refused.
  fileKey: nullableText,
  // Capped at the filesystem convention: it is stored, rendered, and echoed
  // into the download's `Content-Disposition`, so an unbounded name would both
  // write junk to the column and build an oversized response header.
  fileName: nullableText.refine(
    (value) => value === undefined || value === null || value.length <= 255,
    { message: "File name is too long" },
  ),
  // Display only — the authoritative size is the stored object's. Capped at the
  // largest upload tier so a bogus number can't be written to the column.
  fileSize: z
    .number()
    .int("File size must be a whole number")
    .positive("File size must be positive")
    .max(MAX_UPLOAD_BYTES, "File is too large")
    .nullish(),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;

/**
 * Split the drawer's comma-separated tag field into the array the schema
 * expects. Blank entries are dropped, so "a,,b," yields two tags and a trailing
 * comma while typing is harmless.
 *
 * Deduplication is left to the schema, which is the server-side source of truth.
 */
export function parseTagInput(input: string): string[] {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}
