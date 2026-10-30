"use client";

/**
 * The visual editor's blocks for Quill's own Markdown: callouts, steps, tabs, questions, link lists, keys,
 * videos, plus "raw" blocks that keep Markdown the editor has no block for. markdown.ts maps each one to
 * and from Markdown; these only describe how they look and behave while editing.
 */
import { Extension, Mark, Node, mergeAttributes } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { ListItem } from "@tiptap/extension-list";
import { CodeBlock } from "@tiptap/extension-code-block";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import { CALLOUT_KINDS } from "./markdown";
import { stripBase, withBase } from "@/lib/basePath";

const CALLOUT_LABELS: Record<string, string> = { note: "Note", info: "Note (info)", tip: "Tip", warning: "Warning", danger: "Important" };

/** A plain attribute that lives only in the document (it is written to Markdown by markdown.ts, not to HTML). */
const docAttr = (fallback: unknown) => ({ default: fallback, rendered: false });

// ---------- shared pieces of a block's header ----------

function LabelInput({ value, placeholder, label, onChange }: { value: string | null; placeholder: string; label: string; onChange: (v: string | null) => void }) {
  return (
    <input
      className="qe-label-input"
      aria-label={label}
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      // Enter would otherwise reach the editor and split the block.
      onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
    />
  );
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" className="qe-icon" onClick={onClick} aria-label={label} title={label}>
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/** Removes the block but keeps what was inside it. */
function unwrap({ editor, getPos, node }: ReactNodeViewProps) {
  const pos = getPos();
  if (typeof pos !== "number") return;
  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.replaceWith(pos, pos + node.nodeSize, node.content);
      return true;
    })
    .run();
}

// ---------- callouts ----------

function CalloutView(props: ReactNodeViewProps) {
  const { node, updateAttributes } = props;
  const kind = String(node.attrs.kind);
  return (
    <NodeViewWrapper as="aside" className={`callout callout-${kind === "info" ? "note" : kind} qe-block`} data-kind={kind}>
      <div className="qe-block-head" contentEditable={false}>
        <select className="qe-kind" aria-label="Callout type" value={kind} onChange={(e) => updateAttributes({ kind: e.target.value })}>
          {CALLOUT_KINDS.map((k) => (
            <option key={k} value={k}>
              {CALLOUT_LABELS[k]}
            </option>
          ))}
        </select>
        <LabelInput label="Callout title" placeholder={`Title (default: ${CALLOUT_LABELS[kind]?.replace(" (info)", "") ?? "Note"})`} value={node.attrs.label} onChange={(label) => updateAttributes({ label })} />
        <RemoveButton label="Remove callout, keep its text" onClick={() => unwrap(props)} />
      </div>
      <NodeViewContent className="callout-body" />
    </NodeViewWrapper>
  );
}

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes: () => ({ kind: { default: "note" }, label: docAttr(null), attributes: docAttr({}) }),
  parseHTML: () => [{ tag: "aside[data-callout]", getAttrs: (el) => ({ kind: (el as HTMLElement).dataset.callout }) }],
  renderHTML: ({ node, HTMLAttributes }) => ["aside", mergeAttributes(HTMLAttributes, { "data-callout": node.attrs.kind }), 0],
  addNodeView: () => ReactNodeViewRenderer(CalloutView),
});

// ---------- containers with a title: steps, link lists, questions ----------

function containerView(kind: "steps" | "links" | "accordion") {
  const names = { steps: "Steps", links: "Link list", accordion: "Question" };
  return function ContainerView(props: ReactNodeViewProps) {
    const { node, updateAttributes } = props;
    return (
      <NodeViewWrapper className={`qe-block qe-${kind}`}>
        <div className="qe-block-head" contentEditable={false}>
          <span className="qe-tag">{names[kind]}</span>
          {kind === "accordion" ? (
            <LabelInput label="Question" placeholder="The question readers click to open" value={node.attrs.label} onChange={(label) => updateAttributes({ label })} />
          ) : (
            <span className="qe-help">{kind === "steps" ? "Each heading starts a new step." : "A list of links, each with a short description."}</span>
          )}
          <RemoveButton label={`Remove ${names[kind].toLowerCase()}, keep the text`} onClick={() => unwrap(props)} />
        </div>
        <NodeViewContent className="qe-block-body" />
      </NodeViewWrapper>
    );
  };
}

const container = (name: string, view: ReturnType<typeof containerView>, extra: Record<string, unknown> = {}) =>
  Node.create({
    name,
    group: "block",
    content: "block+",
    defining: true,
    addAttributes: () => ({ label: docAttr(null), attributes: docAttr({}), ...extra }),
    parseHTML: () => [{ tag: `div[data-${name}]` }],
    renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { [`data-${name}`]: "" }), 0],
    addNodeView: () => ReactNodeViewRenderer(view),
  });

export const Steps = container("steps", containerView("steps"));
export const LinkList = container("linkList", containerView("links"));
export const Accordion = container("accordion", containerView("accordion"), { name: docAttr("accordion") });

// ---------- tabs ----------

function TabsView(props: ReactNodeViewProps) {
  const { node, editor, getPos } = props;
  const addTab = () => {
    const pos = getPos();
    if (typeof pos !== "number") return;
    const end = pos + node.nodeSize - 1;
    editor
      .chain()
      .focus()
      .insertContentAt(end, { type: "tab", attrs: { label: `Option ${node.childCount + 1}` }, content: [{ type: "paragraph" }] })
      .run();
  };
  return (
    <NodeViewWrapper className="qe-block qe-tabs">
      <div className="qe-block-head" contentEditable={false}>
        <span className="qe-tag">Tabs</span>
        <span className="qe-help">Readers pick one tab. Each tab has its own content.</span>
        <button type="button" className="qe-mini" onClick={addTab}>
          Add tab
        </button>
        <RemoveButton label="Remove tabs, keep their text" onClick={() => unwrap(props)} />
      </div>
      <NodeViewContent className="qe-tabs-body" />
    </NodeViewWrapper>
  );
}

function TabView(props: ReactNodeViewProps) {
  const { node, updateAttributes, editor, getPos } = props;
  const remove = () => {
    const pos = getPos();
    if (typeof pos !== "number") return;
    const parent = editor.state.doc.resolve(pos).parent;
    // The last tab takes the whole tab group with it.
    if (parent.childCount <= 1) editor.chain().focus().deleteRange({ from: pos - 1, to: pos + node.nodeSize + 1 }).run();
    else editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
  };
  return (
    <NodeViewWrapper className="qe-tab">
      <div className="qe-tab-head" contentEditable={false}>
        <LabelInput label="Tab name" placeholder="Tab name" value={node.attrs.label} onChange={(label) => updateAttributes({ label })} />
        <RemoveButton label="Remove this tab" onClick={remove} />
      </div>
      <NodeViewContent className="qe-block-body" />
    </NodeViewWrapper>
  );
}

export const Tabs = Node.create({
  name: "tabs",
  group: "block",
  content: "tab+",
  defining: true,
  addAttributes: () => ({ label: docAttr(null), attributes: docAttr({}) }),
  parseHTML: () => [{ tag: "div[data-tabs-editor]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-tabs-editor": "" }), 0],
  addNodeView: () => ReactNodeViewRenderer(TabsView),
});

export const Tab = Node.create({
  name: "tab",
  content: "block+",
  defining: true,
  isolating: true,
  addAttributes: () => ({ label: docAttr(null), attributes: docAttr({}) }),
  parseHTML: () => [{ tag: "div[data-tab]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-tab": "" }), 0],
  addNodeView: () => ReactNodeViewRenderer(TabView),
});

// ---------- video ----------

function VideoView({ node, updateAttributes, deleteNode, selected }: ReactNodeViewProps) {
  return (
    <NodeViewWrapper className={`qe-block qe-video${selected ? " is-selected" : ""}`} data-drag-handle="">
      <div className="qe-block-head" contentEditable={false}>
        <span className="qe-tag">Video</span>
        <input className="qe-label-input" aria-label="Video address" placeholder="/uploads/clip.mp4" value={node.attrs.src ?? ""} onChange={(e) => updateAttributes({ src: e.target.value })} />
        <input className="qe-label-input" aria-label="Video title" placeholder="Title (optional)" value={node.attrs.title ?? ""} onChange={(e) => updateAttributes({ title: e.target.value || null })} />
        <RemoveButton label="Remove video" onClick={deleteNode} />
      </div>
      {node.attrs.src ? <video className="doc-video" src={withBase(node.attrs.src)} controls muted playsInline preload="metadata" contentEditable={false} /> : null}
    </NodeViewWrapper>
  );
}

export const Video = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes: () => ({ src: { default: "" }, title: { default: null }, attributes: docAttr({}) }),
  parseHTML: () => [{ tag: "video[src]" }],
  renderHTML: ({ HTMLAttributes }) => ["video", mergeAttributes(HTMLAttributes, { controls: "true" })],
  addNodeView: () => ReactNodeViewRenderer(VideoView),
});

// ---------- Markdown kept as written ----------

function RawBlockView({ node, updateAttributes, deleteNode }: ReactNodeViewProps) {
  const source = String(node.attrs.source ?? "");
  return (
    <NodeViewWrapper className="qe-block qe-raw">
      <div className="qe-block-head" contentEditable={false}>
        <span className="qe-tag">Markdown</span>
        <span className="qe-help">Kept exactly as written. The visual editor has no block for this, so edit it here.</span>
        <RemoveButton label="Remove this Markdown" onClick={deleteNode} />
      </div>
      <textarea
        className="qe-raw-source"
        aria-label="Markdown"
        spellCheck={false}
        value={source}
        rows={Math.min(24, source.split("\n").length + 1)}
        onChange={(e) => updateAttributes({ source: e.target.value })}
      />
    </NodeViewWrapper>
  );
}

export const RawBlock = Node.create({
  name: "rawBlock",
  group: "block",
  atom: true,
  addAttributes: () => ({ source: { default: "" } }),
  parseHTML: () => [{ tag: "div[data-raw-markdown]", getAttrs: (el) => ({ source: (el as HTMLElement).textContent }) }],
  renderHTML: ({ node }) => ["div", { "data-raw-markdown": "" }, String(node.attrs.source)],
  addNodeView: () => ReactNodeViewRenderer(RawBlockView),
});

export const RawInline = Node.create({
  name: "rawInline",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes: () => ({ source: { default: "" } }),
  parseHTML: () => [{ tag: "span[data-raw-markdown]", getAttrs: (el) => ({ source: (el as HTMLElement).textContent }) }],
  renderHTML: ({ node }) => ["span", { "data-raw-markdown": "", class: "qe-raw-inline", title: "Markdown kept as written. Edit it in Markdown mode." }, String(node.attrs.source)],
});

// ---------- keys ----------

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    kbd: { toggleKbd: () => ReturnType };
  }
}

export const Kbd = Mark.create({
  name: "kbd",
  excludes: "code",
  parseHTML: () => [{ tag: "kbd" }],
  renderHTML: ({ HTMLAttributes }) => ["kbd", HTMLAttributes, 0],
  addCommands() {
    return { toggleKbd: () => ({ commands }) => commands.toggleMark(this.name) };
  },
  addKeyboardShortcuts() {
    return { "Mod-Shift-k": () => this.editor.commands.toggleKbd() };
  },
});

// ---------- code blocks with a language ----------

const LANGS = ["", "bash", "shell", "powershell", "javascript", "typescript", "json", "html", "css", "markdown", "yaml", "python", "text"];

function CodeBlockView({ node, updateAttributes }: ReactNodeViewProps) {
  const lang = String(node.attrs.language ?? "");
  return (
    <NodeViewWrapper className="qe-code">
      <div className="qe-code-head" contentEditable={false}>
        <input className="qe-label-input" list="qe-langs" aria-label="Code language" placeholder="Language" value={lang} onChange={(e) => updateAttributes({ language: e.target.value.trim() || null })} />
        <datalist id="qe-langs">
          {LANGS.filter(Boolean).map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </div>
      <pre>
        <NodeViewContent<"code"> as="code" />
      </pre>
    </NodeViewWrapper>
  );
}

export const QuillCodeBlock = CodeBlock.extend({
  addAttributes() {
    return { ...this.parent?.(), meta: docAttr(null) };
  },
  addNodeView: () => ReactNodeViewRenderer(CodeBlockView),
});

// ---------- lists, headings, tables and images, as Markdown has them ----------

/** List items can start with any block (as in Markdown) and can be checklist items. */
export const QuillListItem = ListItem.extend({
  content: "block+",
  addAttributes() {
    return {
      ...this.parent?.(),
      checked: { default: null, renderHTML: (a) => (a.checked === null ? {} : { "data-checked": String(a.checked) }), parseHTML: (el) => (el.dataset.checked ? el.dataset.checked === "true" : null) },
      spread: docAttr(false),
    };
  },
});

/** Loose lists, headings sitting directly on their text, and table column alignment. */
export const MarkdownDetails = Extension.create({
  name: "markdownDetails",
  addGlobalAttributes: () => [
    { types: ["bulletList", "orderedList"], attributes: { spread: docAttr(false) } },
    { types: ["heading"], attributes: { tight: docAttr(false) } },
    { types: ["table"], attributes: { align: docAttr([]) } },
  ],
});

/** A Markdown table cell is one line of text. */
export const QuillTableCell = TableCell.extend({ content: "paragraph+" });
export const QuillTableHeader = TableHeader.extend({ content: "paragraph+" });
export const QuillTable = Table.configure({ resizable: false, HTMLAttributes: { class: "doc-table" } });
export { TableRow };

/** Images sit in the text, as they do in Markdown. */
export const QuillImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      // Stored relative to Quill's root, like the Markdown; shown with the base path when Quill runs under one.
      src: { default: null, parseHTML: (el) => stripBase(el.getAttribute("src") ?? ""), renderHTML: (a) => ({ src: a.src ? withBase(a.src) : a.src }) },
    };
  },
}).configure({ inline: true, allowBase64: false });
