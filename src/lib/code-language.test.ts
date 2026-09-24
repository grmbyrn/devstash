import { describe, expect, it } from "vitest";

import {
  DEFAULT_LANGUAGE,
  languageLabel,
  normalizeLanguage,
} from "./code-language";

describe("normalizeLanguage", () => {
  it("passes a canonical Monaco id through unchanged", () => {
    expect(normalizeLanguage("typescript")).toBe("typescript");
    expect(normalizeLanguage("python")).toBe("python");
  });

  it("is case-insensitive", () => {
    expect(normalizeLanguage("TypeScript")).toBe("typescript");
    expect(normalizeLanguage("PYTHON")).toBe("python");
  });

  it("resolves common aliases to their Monaco id", () => {
    expect(normalizeLanguage("ts")).toBe("typescript");
    expect(normalizeLanguage("js")).toBe("javascript");
    expect(normalizeLanguage("py")).toBe("python");
  });

  it("maps every shell spelling onto Monaco's single `shell` id", () => {
    // Monaco has no `bash`; sending it would silently lose highlighting.
    for (const spelling of ["sh", "bash", "zsh", "console", "terminal"]) {
      expect(normalizeLanguage(spelling)).toBe("shell");
    }
  });

  it("trims surrounding whitespace and a leading dot", () => {
    expect(normalizeLanguage("  rust  ")).toBe("rust");
    expect(normalizeLanguage(".rs")).toBe("rust");
  });

  it("falls back to plaintext for an absent language", () => {
    expect(normalizeLanguage(null)).toBe(DEFAULT_LANGUAGE);
    expect(normalizeLanguage(undefined)).toBe(DEFAULT_LANGUAGE);
    expect(normalizeLanguage("")).toBe(DEFAULT_LANGUAGE);
    expect(normalizeLanguage("   ")).toBe(DEFAULT_LANGUAGE);
  });

  it("falls back to plaintext for prose rather than treating it as an id", () => {
    expect(normalizeLanguage("some random words")).toBe(DEFAULT_LANGUAGE);
    expect(normalizeLanguage("not a language!")).toBe(DEFAULT_LANGUAGE);
  });

  it("passes an unlisted single word through as a possible Monaco id", () => {
    // Monaco knows far more languages than the table lists; an id it doesn't
    // know renders as plain text anyway, so this can't do harm.
    expect(normalizeLanguage("elixir")).toBe("elixir");
    expect(normalizeLanguage("clojure")).toBe("clojure");
  });

  it("keeps the punctuation that is part of a language name", () => {
    expect(normalizeLanguage("c#")).toBe("csharp");
    expect(normalizeLanguage("c++")).toBe("cpp");
  });
});

describe("languageLabel", () => {
  it("prints the canonical label for a known language", () => {
    expect(languageLabel("ts")).toBe("TypeScript");
    expect(languageLabel("bash")).toBe("Shell");
    expect(languageLabel("JSON")).toBe("JSON");
  });

  it("echoes the user's own text for an unknown language", () => {
    // Overriding it with "Plain text" would read as though the value was lost.
    expect(languageLabel("Brainfuck")).toBe("Brainfuck");
  });

  it("returns null when there is nothing to show", () => {
    expect(languageLabel(null)).toBeNull();
    expect(languageLabel(undefined)).toBeNull();
    expect(languageLabel("")).toBeNull();
    expect(languageLabel("   ")).toBeNull();
  });
});
