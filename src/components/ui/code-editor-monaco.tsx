"use client";

import * as React from "react";
import Editor, { loader, type OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

declare global {
  interface Window {
    MonacoEnvironment?: monaco.Environment;
  }
}

/**
 * Monaco starts one background worker for its core editor services, and left to
 * itself it builds that worker through a `blob:` trampoline that `import`s the
 * real script by absolute path. A `blob:` URL has an opaque base, so that import
 * cannot resolve and the console fills with "Failed to load worker script for
 * label: editorWorkerService".
 *
 * Handing Monaco the worker directly skips the trampoline entirely: the bundler
 * sees a static `new URL(..., import.meta.url)` and emits the worker as its own
 * chunk. The URL has to be *relative* — Turbopack cannot resolve a bare package
 * specifier there — which is the only reason `monaco.worker.ts` exists.
 *
 * Only the core editor worker is ever requested: the language-service workers
 * (TypeScript, JSON, CSS, HTML) are never registered, so one branch covers
 * every label.
 */
if (typeof window !== "undefined") {
  window.MonacoEnvironment = {
    getWorker: () =>
      new Worker(new URL("./monaco.worker.ts", import.meta.url), {
        type: "module",
      }),
  };
}

/**
 * The Monaco instance itself. Loaded only through `next/dynamic` from
 * `code-editor.tsx` — never import this module statically, or several megabytes
 * of editor land in the dashboard's initial payload.
 *
 * `loader.config({ monaco })` points `@monaco-editor/react` at the copy we
 * bundle. Without it the wrapper fetches `monaco-editor` from the jsDelivr CDN
 * at runtime, which adds a third-party network dependency to a page that has
 * none and breaks the app offline.
 *
 * The `monaco-editor` entry registers 81 languages with *lazy* loaders, so each
 * grammar is its own chunk and only the one in use is fetched. It deliberately
 * pulls in none of the worker-backed language services (TypeScript, JSON, CSS,
 * HTML), which is why no `MonacoEnvironment.getWorker` is configured here:
 * highlighting runs on the main thread, and IntelliSense/diagnostics are out of
 * scope for this component.
 */
loader.config({ monaco });

/**
 * Monaco paints its own chrome, so the theme is the only way to reach it — the
 * scrollbar in particular is drawn by the editor and cannot be styled from CSS.
 *
 * The app's tokens in `globals.css` are `oklch`, which Monaco does not accept,
 * so these are the sRGB equivalents of the `.dark` palette:
 *
 *   #171717  --card              oklch(0.205 0 0)
 *   #fafafa  --foreground        oklch(0.985 0 0)
 *   #a1a1a1  --muted-foreground  oklch(0.708 0 0)
 *   #262626  --muted             oklch(0.269 0 0)
 *
 * `editor.background` matches `--card` and the chrome around it uses `bg-card`,
 * so the editor sits flush on the app's surface with no seam.
 */
const EDITOR_COLORS: monaco.editor.IStandaloneThemeData["colors"] = {
  "editor.background": "#171717",
  "editor.foreground": "#fafafa",
  "editorGutter.background": "#171717",
  "editorLineNumber.foreground": "#525252",
  "editorLineNumber.activeForeground": "#a1a1a1",
  "editor.lineHighlightBackground": "#1f1f1f",
  "editor.lineHighlightBorder": "#00000000",
  "editor.selectionBackground": "#3f3f46",
  "editor.inactiveSelectionBackground": "#262626",
  "editor.selectionHighlightBackground": "#26262680",
  "editorCursor.foreground": "#fafafa",
  "editorWidget.background": "#171717",
  "editorWidget.border": "#2e2e2e",
  "editorOverviewRuler.border": "#00000000",
  // The themed scrollbar the spec asks for: white at 12/20/30% over the
  // surface, matching the app's `--border` (white at 10%) but a step brighter
  // so the slider reads as interactive rather than as a divider.
  "scrollbarSlider.background": "#ffffff1f",
  "scrollbarSlider.hoverBackground": "#ffffff33",
  "scrollbarSlider.activeBackground": "#ffffff4d",
};

const THEME = "devstash-dark";
const THEME_READONLY = "devstash-dark-readonly";

/**
 * Dark only, consistent with the rest of the app: `.dark` is hardcoded on the
 * root layout and `sonner.tsx` pins `theme="dark"` for the same reason. A light
 * theme lands when light mode does.
 */
function defineThemes(instance: typeof monaco) {
  instance.editor.defineTheme(THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: EDITOR_COLORS,
  });

  // Readonly must not look like a disabled input, but it must not look like a
  // focused text field either: a fully transparent caret is Monaco's own way to
  // hide the cursor, and leaves the text selectable so the copy button isn't
  // the only way to get code out.
  instance.editor.defineTheme(THEME_READONLY, {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: { ...EDITOR_COLORS, "editorCursor.foreground": "#00000000" },
  });
}

export interface CodeEditorMonacoProps {
  value: string;
  /** Absent means readonly. */
  onChange?: (value: string) => void;
  /** A Monaco language id — already normalized by the caller. */
  language: string;
  /** Accessible name, since the visible label can't point at Monaco's textarea. */
  ariaLabel: string;
  minHeight: number;
  maxHeight: number;
}

export default function CodeEditorMonaco({
  value,
  onChange,
  language,
  ariaLabel,
  minHeight,
  maxHeight,
}: CodeEditorMonacoProps) {
  const readOnly = onChange === undefined;

  // Monaco does not size itself to its content — it fills whatever box it is
  // given. Growing to fit means reading the content height back out and setting
  // the box from it, clamped to the 400px cap after which the editor scrolls.
  const [height, setHeight] = React.useState(minHeight);
  const disposableRef = React.useRef<monaco.IDisposable | null>(null);

  React.useEffect(() => () => disposableRef.current?.dispose(), []);

  const handleMount: OnMount = React.useCallback(
    (editor) => {
      const sync = () => {
        const content = editor.getContentHeight();
        setHeight(Math.min(Math.max(content, minHeight), maxHeight));
      };

      sync();
      disposableRef.current = editor.onDidContentSizeChange(sync);
    },
    [minHeight, maxHeight],
  );

  return (
    <Editor
      height={height}
      language={language}
      value={value}
      onChange={(next) => onChange?.(next ?? "")}
      beforeMount={defineThemes}
      onMount={handleMount}
      theme={readOnly ? THEME_READONLY : THEME}
      options={{
        readOnly,
        // Also marks Monaco's underlying textarea readonly, so the OS doesn't
        // offer a caret or the mobile keyboard on a view-mode snippet.
        domReadOnly: readOnly,
        ariaLabel,
        // Without this a short snippet gets a screenful of dead space below it,
        // and the content height never settles.
        scrollBeyondLastLine: false,
        // The drawer slides in and the create dialog is centered, so the editor
        // is first measured while its container is still animating; this
        // re-measures instead of staying stuck at that transient size.
        automaticLayout: true,
        minimap: { enabled: false },
        overviewRulerLanes: 0,
        overviewRulerBorder: false,
        hideCursorInOverviewRuler: true,
        scrollbar: {
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
          useShadows: false,
          // The editor sits inside a scrolling drawer; swallowing the wheel
          // would trap the page scroll once the pointer crossed it.
          alwaysConsumeMouseWheel: false,
        },
        // Long lines wrap rather than scrolling sideways — the drawer is narrow
        // and full-width on mobile.
        wordWrap: "on",
        fontSize: 12,
        lineHeight: 20,
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        fontLigatures: false,
        padding: { top: 12, bottom: 12 },
        lineNumbersMinChars: 3,
        renderLineHighlight: readOnly ? "none" : "line",
        tabSize: 2,
        // Highlighting only — no IntelliSense, diagnostics or formatting.
        quickSuggestions: false,
        suggestOnTriggerCharacters: false,
        parameterHints: { enabled: false },
        folding: false,
        contextmenu: false,
        occurrencesHighlight: "off",
        renderWhitespace: "none",
        stickyScroll: { enabled: false },
        guides: { indentation: false },
        smoothScrolling: true,
      }}
      loading={null}
    />
  );
}
