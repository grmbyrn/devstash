/**
 * `Item.language` is free text — a plain `<Input>` with a "typescript"
 * placeholder, validated by nothing. So it can hold `TypeScript`, `ts`, `sh`,
 * an empty string, or complete nonsense.
 *
 * Monaco needs a *registered* language id, and silently renders unhighlighted
 * text for anything it doesn't know. These helpers are the one place that maps
 * what a user typed onto an id Monaco recognises, falling back to `plaintext`
 * rather than guessing — so a snippet saved with no language at all, or with a
 * typo, still renders as readable code instead of breaking the editor.
 */

/**
 * Monaco language id → display label and the spellings that map onto it.
 *
 * Only languages worth recognising are listed; Monaco knows many more, and one
 * whose id is typed exactly (e.g. `kotlin`) is accepted by the id check below
 * without needing an entry here. Aliases are lowercase — input is lowercased
 * before lookup.
 */
const LANGUAGES: Record<string, { label: string; aliases: readonly string[] }> =
  {
    typescript: { label: "TypeScript", aliases: ["ts", "tsx"] },
    javascript: { label: "JavaScript", aliases: ["js", "jsx", "node"] },
    python: { label: "Python", aliases: ["py", "python3"] },
    shell: {
      label: "Shell",
      aliases: ["sh", "bash", "zsh", "console", "terminal", "command"],
    },
    json: { label: "JSON", aliases: ["jsonc", "json5"] },
    yaml: { label: "YAML", aliases: ["yml"] },
    sql: { label: "SQL", aliases: ["postgres", "postgresql", "mysql"] },
    html: { label: "HTML", aliases: [] },
    css: { label: "CSS", aliases: [] },
    scss: { label: "SCSS", aliases: ["sass"] },
    markdown: { label: "Markdown", aliases: ["md", "mdx"] },
    dockerfile: { label: "Dockerfile", aliases: ["docker"] },
    go: { label: "Go", aliases: ["golang"] },
    rust: { label: "Rust", aliases: ["rs"] },
    java: { label: "Java", aliases: [] },
    kotlin: { label: "Kotlin", aliases: ["kt"] },
    swift: { label: "Swift", aliases: [] },
    ruby: { label: "Ruby", aliases: ["rb"] },
    php: { label: "PHP", aliases: [] },
    csharp: { label: "C#", aliases: ["cs", "c#"] },
    cpp: { label: "C++", aliases: ["c++", "cc", "cxx"] },
    c: { label: "C", aliases: [] },
    graphql: { label: "GraphQL", aliases: ["gql"] },
    xml: { label: "XML", aliases: [] },
    ini: { label: "INI", aliases: ["env", "dotenv", "conf", "toml"] },
    plaintext: { label: "Plain text", aliases: ["text", "txt", "plain"] },
  };

/** Every alias, flattened once, pointing at its canonical Monaco id. */
const ALIAS_TO_ID = new Map<string, string>(
  Object.entries(LANGUAGES).flatMap(([id, { aliases }]) => [
    [id, id] as const,
    ...aliases.map((alias) => [alias, id] as const),
  ]),
);

export const DEFAULT_LANGUAGE = "plaintext";

/** Lowercase and strip the punctuation a typed language might carry. */
function canonicalize(raw: string): string {
  return raw.trim().toLowerCase().replace(/^\./, "");
}

/**
 * Resolve free text to a Monaco language id.
 *
 * Unknown values fall back to `plaintext` so the editor always has a valid id.
 * A value that isn't in the table but *is* a plain word is passed through, on
 * the bet that it's a Monaco id this table simply doesn't list (Monaco knows
 * ~80 languages) — an id Monaco doesn't recognise renders as plain text
 * anyway, which is the same outcome as the fallback.
 */
export function normalizeLanguage(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_LANGUAGE;

  const key = canonicalize(raw);
  if (!key) return DEFAULT_LANGUAGE;

  const known = ALIAS_TO_ID.get(key);
  if (known) return known;

  // Anything with a space or punctuation is prose, not a language id.
  return /^[a-z0-9+#-]+$/.test(key) ? key : DEFAULT_LANGUAGE;
}

/**
 * How to print the language beside the copy button.
 *
 * Returns the table's label for a known language, otherwise the user's own
 * trimmed text — they typed something meaningful to them, and overriding it
 * with "Plain text" would look like the value was lost. Empty input returns
 * null so the header can omit the slot entirely.
 */
export function languageLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const key = canonicalize(raw);
  if (!key) return null;

  const id = ALIAS_TO_ID.get(key);
  return id ? LANGUAGES[id].label : raw.trim();
}
