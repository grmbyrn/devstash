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
 * Whether an item of this type can be created by typing into a form.
 *
 * File and image items are `ContentType.FILE`: they exist because something was
 * uploaded, and their body is an R2 URL rather than text. Uploads aren't wired
 * up, so the create dialog offers the five text types only — and the server
 * checks this too, so a hand-made payload can't create an empty file item.
 */
const FILE_UPLOAD_TYPES = new Set(["file", "image"]);

export function isCreatableType(typeName: string): boolean {
  return !FILE_UPLOAD_TYPES.has(typeName);
}
