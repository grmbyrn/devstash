import { normalizeLanguage } from "@/lib/code-language";

/**
 * Item types are stored singular (`"snippet"`) but routed and labelled plural
 * (`/items/snippets`, "Snippets"). These helpers keep that mapping in one place
 * so the sidebar links and the `/items/[type]` route can never drift apart.
 */

/** The URL segment for a type, e.g. `"snippet"` → `"snippets"`. */
export function typeSlug(name: string): string {
  return `${name}s`;
}

/** The display label for a type, e.g. `"snippet"` → `"Snippets"`. */
export function typeLabel(name: string): string {
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}s`;
}

/**
 * Resolve a URL segment back to its type. Compares against `typeSlug` rather
 * than stripping a trailing "s", so the two directions stay symmetric even if
 * pluralization ever grows special cases.
 */
export function findTypeBySlug<T extends { name: string }>(
  types: T[],
  slug: string,
): T | undefined {
  return types.find((type) => typeSlug(type.name) === slug);
}

/**
 * Which body fields an item type actually uses.
 *
 * All types share title, description and tags; these three vary. Keeping the
 * mapping here rather than as conditionals inside the editor means the drawer
 * has one place to ask, and it can be tested without rendering anything.
 *
 * Unknown type names get none of the optional fields, so a custom type added
 * later degrades to title/description/tags instead of showing a wrong editor.
 */
const TYPES_WITH_CONTENT = new Set(["snippet", "prompt", "command", "note"]);
const TYPES_WITH_LANGUAGE = new Set(["snippet", "command"]);
const TYPES_WITH_URL = new Set(["link"]);

export interface EditableFields {
  content: boolean;
  language: boolean;
  url: boolean;
}

export function editableFields(typeName: string): EditableFields {
  return {
    content: TYPES_WITH_CONTENT.has(typeName),
    language: TYPES_WITH_LANGUAGE.has(typeName),
    url: TYPES_WITH_URL.has(typeName),
  };
}

/**
 * Whether an item of this type is created by uploading an object rather than by
 * typing a body.
 *
 * File and image items are `ContentType.FILE`: their body lives in R2 and the
 * row carries `fileUrl`/`fileName`/`fileSize` instead of `content`. Every
 * creatable type is now one or the other, which is why this replaced the old
 * `isCreatableType` — with uploads wired up, nothing is uncreatable any more,
 * so the question worth asking is which *kind* of create a type needs.
 *
 * The create action re-checks this: an upload type submitted without a stored
 * object is refused, and file fields sent for a text type are dropped.
 */
const FILE_UPLOAD_TYPES = new Set(["file", "image"]);

export function isUploadType(typeName: string): boolean {
  return FILE_UPLOAD_TYPES.has(typeName);
}

/**
 * Whether a type's content is prose that should be written and previewed as
 * Markdown, rather than code.
 *
 * This is the complement of `TYPES_WITH_LANGUAGE` within the types that have
 * content at all — notes and prompts — so it could be derived rather than
 * listed. It is spelled out instead because "prose gets Markdown" is its own
 * decision, not a side effect of "code gets a language"; a future type could
 * easily want one without the other. A test pins the two lists to the same
 * answer for every system type, so the redundancy cannot rot silently.
 */
const TYPES_WITH_MARKDOWN = new Set(["prompt", "note"]);

export function usesMarkdown(typeName: string): boolean {
  return TYPES_WITH_MARKDOWN.has(typeName);
}

/**
 * Whether an item's content should be rendered and edited as Markdown.
 *
 * Two routes in, because the type alone is not enough:
 *
 *  - Notes and prompts are prose by definition, so they always are.
 *  - A snippet or command whose `language` says `markdown` (or `md`/`mdx`) is a
 *    Markdown *document* that happens to be filed as a snippet — a README, a
 *    runbook, a set of notes with fenced examples. Those render as Markdown too.
 *
 * Keying the second route off `language` rather than sniffing the content is
 * what keeps code safe: a Dockerfile or a shell script is full of lines
 * starting with `#`, which a content heuristic reads as headings and a language
 * check does not. The field already carries the answer, and the author sets it.
 */
export function rendersAsMarkdown(
  typeName: string,
  language?: string | null,
): boolean {
  if (usesMarkdown(typeName)) return true;
  // Only types that actually have a language field can opt in this way.
  if (!editableFields(typeName).language) return false;
  return normalizeLanguage(language) === "markdown";
}
