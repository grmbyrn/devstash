/**
 * Worker entry for Monaco's core editor services, referenced by
 * `code-editor-monaco.tsx` as `new Worker(new URL("./monaco.worker.ts", …))`.
 *
 * It exists only so that URL can be *relative*: Turbopack resolves a relative
 * specifier inside `new URL(..., import.meta.url)` and emits the worker as its
 * own chunk, but cannot resolve a bare package specifier there. Importing
 * Monaco's worker module for its side effects is the whole job.
 */
import "monaco-editor/editor/editor.worker.js";
