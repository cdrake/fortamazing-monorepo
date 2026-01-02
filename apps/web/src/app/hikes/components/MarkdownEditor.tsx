// components/MarkdownEditor.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

type Props = {
  value: string;
  onChange: (v: string) => void;
  editable?: boolean;
  defaultLayout?: "split" | "preview-only" | "editor-only";
  placeholder?: string;
  className?: string;
  rows?: number;
};

export default function MarkdownEditor({
  value,
  onChange,
  editable = true,
  defaultLayout = "split",
  placeholder = "Write markdown…",
  className = "",
  rows = 12,
}: Props) {
  const [layout, setLayout] = useState(defaultLayout);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Normalize any escaped-newline sequences into real newlines, and canonicalize CRLF
  const normalizeNewlines = useCallback((s: string) => s.replace(/\\r?\\n/g, "\n").replace(/\r\n/g, "\n"), []);

  // Helper: ensure there is a blank line before insertion (GitHub-style parsing needs this for lists/headings)
  const ensureBlankLineBefore = (text: string, insertPos: number) => {
    // find char before insertPos
    if (insertPos <= 0) return "";
    const prevChar = text[insertPos - 1];
    if (prevChar === "\n") {
      // if previous char is newline, but we also want a blank line (i.e., another \n) when previous line is non-empty
      // check char before that
      if (insertPos - 2 >= 0 && text[insertPos - 2] !== "\n") return "\n";
      return "";
    }
    // not at newline -> add two newlines to create a blank line
    return "\n\n";
  };

  // Insert text at cursor, handling selection and cursor restore
  const insertAtCursor = useCallback((before: string, after = "", placeholderText = "") => {
    const ta = textareaRef.current;
    const curVal = value ?? "";
    const normVal = normalizeNewlines(curVal);
    if (!ta) {
      onChange(normVal + before + (placeholderText || "") + after);
      return;
    }

    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;

    // ensure blank line only for lists/headers inserted at a mid-line
    let prefix = "";
    if (/^(\s*[-*+] |\d+\. |#+ )/.test(before)) {
      prefix = ensureBlankLineBefore(normVal, start);
    }

    const selected = normVal.slice(start, end) || placeholderText;
    const newVal = normVal.slice(0, start) + prefix + before + selected + after + normVal.slice(end);
    onChange(newVal);

    requestAnimationFrame(() => {
      ta.focus();
      const cursorStart = (start + prefix.length + before.length);
      const cursorEnd = cursorStart + (selected.length);
      try { ta.setSelectionRange(cursorStart, cursorEnd); } catch {}
    });
  }, [onChange, value, normalizeNewlines]);

  // Toolbar actions (wrap or insert)
  const onBold = useCallback(() => insertAtCursor("**", "**", "bold text"), [insertAtCursor]);
  const onItalic = useCallback(() => insertAtCursor("_", "_", "italic"), [insertAtCursor]);
  const onCode = useCallback(() => insertAtCursor("```\n", "\n```", "code"), [insertAtCursor]);
  const onInlineCode = useCallback(() => insertAtCursor("`", "`", "code"), [insertAtCursor]);
  const onH1 = useCallback(() => insertAtCursor("# ", "", "Heading 1"), [insertAtCursor]);
  const onH2 = useCallback(() => insertAtCursor("## ", "", "Heading 2"), [insertAtCursor]);
  const onUl = useCallback(() => insertAtCursor("- ", "", "list item"), [insertAtCursor]);
  const onOl = useCallback(() => insertAtCursor("1. ", "", "list item"), [insertAtCursor]);
  const onQuote = useCallback(() => insertAtCursor("> ", "", "quote"), [insertAtCursor]);
  const onTask = useCallback(() => insertAtCursor("- [ ] ", "", "task item"), [insertAtCursor]);
  const onLink = useCallback(() => insertAtCursor("[", "](https://example.com)", "link text"), [insertAtCursor]);
  const onImage = useCallback(() => insertAtCursor("![", "](https://example.com/image.jpg)", "alt text"), [insertAtCursor]);

  // a small toolbar button component
  const ToolbarButton = ({ onClick, label, title }: { onClick: () => void; label: React.ReactNode; title?: string }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
    >
      {label}
    </button>
  );

  // Preview content: use normalized value
  const normalizedForPreview = normalizeNewlines(value ?? "");

  // React-Markdown components mapping to prevent CSS hiding bullets/headings
  const mdComponents = {
    h1: ({ node, ...props }: any) => <h1 className="text-xl font-semibold mt-2" {...props} />,
    h2: ({ node, ...props }: any) => <h2 className="text-lg font-semibold mt-2" {...props} />,
    h3: ({ node, ...props }: any) => <h3 className="text-base font-medium mt-2" {...props} />,
    p: ({ node, ...props }: any) => <p className="mt-1" {...props} />,
    ul: ({ node, ...props }: any) => <ul className="list-disc ml-5 mt-1" {...props} />,
    ol: ({ node, ...props }: any) => <ol className="list-decimal ml-5 mt-1" {...props} />,
    li: ({ node, ...props }: any) => <li className="mt-1" {...props} />,
    a: ({ node, ...props }: any) => <a className="underline" {...props} />,
    blockquote: ({ node, ...props }: any) => <blockquote className="pl-3 border-l-2 italic text-gray-600" {...props} />,
    code: ({ node, inline, className, children, ...props }: any) =>
      inline ? <code className="bg-gray-100 rounded px-1" {...props}>{children}</code> : <pre className="p-2 bg-gray-100 rounded overflow-auto"><code {...props}>{children}</code></pre>,
  };

  const PreviewPane = (
    <div className="w-full overflow-auto">
      <div className="prose max-w-none text-sm">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={isMounted ? [rehypeRaw, rehypeSanitize] : [rehypeSanitize]}
          components={mdComponents}
        >
          {normalizedForPreview}
        </ReactMarkdown>
      </div>
    </div>
  );

  return (
    <div className={`markdown-editor w-full ${className}`}>
      {editable ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1 flex-wrap">
              <ToolbarButton onClick={onBold} label={<strong>B</strong>} title="Bold" />
              <ToolbarButton onClick={onItalic} label={<em>I</em>} title="Italic" />
              <ToolbarButton onClick={onInlineCode} label={<code>code</code>} title="Inline code" />
              <ToolbarButton onClick={onCode} label={<span className="text-xs">Code block</span>} title="Code block" />
              <ToolbarButton onClick={onH1} label={"H1"} title="Heading 1" />
              <ToolbarButton onClick={onH2} label={"H2"} title="Heading 2" />
              <ToolbarButton onClick={onUl} label={"• List"} title="Unordered list" />
              <ToolbarButton onClick={onOl} label={"1. List"} title="Ordered list" />
              <ToolbarButton onClick={onTask} label={"☑"} title="Task list" />
              <ToolbarButton onClick={onQuote} label={"“”"} title="Blockquote" />
              <ToolbarButton onClick={onLink} label={"🔗"} title="Insert link" />
              <ToolbarButton onClick={onImage} label={"🖼"} title="Insert image" />
            </div>

            <div className="flex gap-1 items-center">
              <button
                type="button"
                onClick={() => setLayout("editor-only")}
                className={`px-2 py-1 border rounded text-xs ${layout === "editor-only" ? "bg-sky-50" : ""}`}
                title="Editor only"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setLayout("split")}
                className={`px-2 py-1 border rounded text-xs ${layout === "split" ? "bg-sky-50" : ""}`}
                title="Split (editor + preview)"
              >
                Split
              </button>
              <button
                type="button"
                onClick={() => setLayout("preview-only")}
                className={`px-2 py-1 border rounded text-xs ${layout === "preview-only" ? "bg-sky-50" : ""}`}
                title="Preview only"
              >
                Preview
              </button>
            </div>
          </div>

          <div className="w-full border rounded overflow-hidden flex flex-col md:flex-row gap-2">
            {(layout === "split" || layout === "editor-only") && (
              <div className={`${layout === "split" ? "md:w-1/2 w-full" : "w-full"} p-2`}>
                <textarea
                  ref={textareaRef}
                  value={value}
                  onChange={(e) => onChange(normalizeNewlines(e.target.value))}
                  placeholder={placeholder}
                  rows={rows}
                  className="w-full h-full min-h-[160px] resize-y p-2 border rounded text-sm"
                />
              </div>
            )}

            {(layout === "split" || layout === "preview-only") && (
              <div className={`${layout === "split" ? "md:w-1/2 w-full border-l md:border-l-0 md:pl-0 md:pr-0" : "w-full"} p-2 bg-white`}>
                {PreviewPane}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-2">{PreviewPane}</div>
      )}
    </div>
  );
}
