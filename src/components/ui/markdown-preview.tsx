"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * The rendered half of `MarkdownEditor`, kept in its own module so
 * `next/dynamic` can fetch react-markdown only once a preview is actually
 * opened — the same split `CodeEditor` makes around Monaco.
 *
 * Deliberately no `rehype-raw`: react-markdown does not render embedded HTML
 * unless that plugin is added, and leaving it out is what keeps a stored note
 * from injecting markup into the page. Item content is user-supplied text.
 */
export default function MarkdownPreview({ value }: { value: string }) {
  return (
    <div className="markdown-preview">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Every link leaves the app, so none of them should hand the opened
          // page a reference back to this window.
          a: ({ ...props }) => (
            <a {...props} target="_blank" rel="noreferrer noopener" />
          ),
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}
