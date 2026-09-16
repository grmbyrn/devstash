import { z } from "zod";

/** Upper bound on tags per item, so a paste can't write unbounded rows. */
export const MAX_TAGS = 25;

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

/**
 * Payload for `updateItem`. Every field except `title` is optional so a partial
 * save touches only what it sends.
 */
export const updateItemSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
  description: nullableText,
  content: nullableText,
  language: nullableText,
  url: nullableUrl,
  tags: z
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
    .optional(),
});

export type UpdateItemInput = z.infer<typeof updateItemSchema>;

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
