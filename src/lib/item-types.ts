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
