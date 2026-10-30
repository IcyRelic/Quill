"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { docToMarkdown, markdownToDoc, type PMNode } from "./markdown";
import {
  Accordion,
  Callout,
  Kbd,
  LinkList,
  MarkdownDetails,
  QuillCodeBlock,
  QuillImage,
  QuillListItem,
  QuillTable,
  QuillTableCell,
  QuillTableHeader,
  RawBlock,
  RawInline,
  Steps,
  Tab,
  TableRow,
  Tabs,
  Video,
} from "./nodes";

type Props = {
  markdown: string;
  onChange: (markdown: string) => void;
  /** Uploads a file and returns its address. */
  upload: (file: File) => Promise<{ url: string; name: string }>;
  /** The page couldn't be shown visually; the caller switches to Markdown. */
  onUnsupported: (message: string) => void;
  onError: (message: string) => void;
  /** Set to a function that writes a change still waiting to `onChange` and returns it (null when none is waiting). */
  flushRef?: React.RefObject<(() => string | null) | null>;
  /** Shown above the text, in the page column (the title and description). */
  header?: React.ReactNode;
};

const STEPS_TEMPLATE: PMNode[] = [
  { type: "heading", attrs: { level: 3, tight: true }, content: [{ type: "text", text: "First step" }] },
  { type: "paragraph", content: [{ type: "text", text: "What to do." }] },
  { type: "heading", attrs: { level: 3, tight: true }, content: [{ type: "text", text: "Second step" }] },
  { type: "paragraph", content: [{ type: "text", text: "What to do next." }] },
];
const para = (text: string): PMNode => ({ type: "paragraph", content: [{ type: "text", text }] });
const TABS_TEMPLATE: PMNode = {
  type: "tabs",
  content: [
    { type: "tab", attrs: { label: "Mac" }, content: [para("Mac instructions.")] },
    { type: "tab", attrs: { label: "Windows" }, content: [para("Windows instructions.")] },
  ],
};

function Btn({ label, title, active, disabled, onClick, children }: { label: string; title?: string; active?: boolean; disabled?: boolean; onClick: () => void; children?: React.ReactNode }) {
  return (
    <button
      type="button"
      className="qe-btn"
      aria-label={children ? label : undefined}
      title={title ?? label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      // Keep the editor's selection while clicking the toolbar.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children ?? label}
    </button>
  );
}

const Icon = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function blockType(editor: Editor) {
  for (const level of [1, 2, 3, 4, 5, 6]) if (editor.isActive("heading", { level })) return `h${level}`;
  return editor.isActive("paragraph") ? "p" : "";
}

/** Wraps the current block in a container, or inserts a fresh one on an empty line. */
function wrapOrInsert(editor: Editor, type: string, attrs: Record<string, unknown>, template: PMNode[]) {
  const { $from, empty } = editor.state.selection;
  const onEmptyLine = empty && $from.parent.type.name === "paragraph" && $from.parent.content.size === 0;
  if (!onEmptyLine && editor.can().wrapIn(type, attrs)) {
    editor.chain().focus().wrapIn(type, attrs).run();
    return;
  }
  editor.chain().focus().insertContent({ type, attrs, content: template }).run();
}

function Toolbar({ editor, upload, onError }: { editor: Editor; upload: Props["upload"]; onError: Props["onError"] }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: blockType(e),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      kbd: e.isActive("kbd"),
      link: e.isActive("link"),
      href: (e.getAttributes("link").href as string | undefined) ?? "",
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      checklist: e.isActive("listItem") && e.getAttributes("listItem").checked != null,
      quote: e.isActive("blockquote"),
      codeBlock: e.isActive("codeBlock"),
      table: e.isActive("table"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");
  const [imageOpen, setImageOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const chain = () => editor.chain().focus();

  const setBlock = (v: string) => {
    if (v === "p") chain().setParagraph().run();
    else chain().setHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 | 4 }).run();
  };
  const openLink = () => {
    setHref(state.href || "");
    setImageOpen(false);
    setLinkOpen((o) => !o);
  };
  const applyLink = () => {
    const url = href.trim();
    if (!url) chain().extendMarkRange("link").unsetLink().run();
    else if (editor.state.selection.empty && !state.link) chain().insertContent({ type: "text", text: url, marks: [{ type: "link", attrs: { href: url } }] }).run();
    else chain().extendMarkRange("link").setLink({ href: url }).run();
    setLinkOpen(false);
  };
  const toggleChecklist = () => {
    if (!editor.isActive("listItem")) chain().toggleBulletList().run();
    chain().updateAttributes("listItem", { checked: state.checklist ? null : false }).run();
  };
  const onFiles = async (files: FileList | null) => {
    for (const f of Array.from(files ?? [])) {
      try {
        const up = await upload(f);
        if (f.type.startsWith("video/")) chain().insertContent({ type: "video", attrs: { src: up.url } }).run();
        else chain().setImage({ src: up.url, alt: f.name.replace(/\.[^.]+$/, "") }).run();
      } catch (e) {
        onError((e as Error).message);
      }
    }
  };
  const addImageByUrl = () => {
    if (imageUrl.trim()) chain().setImage({ src: imageUrl.trim(), alt: imageAlt.trim() }).run();
    setImageOpen(false);
    setImageUrl("");
    setImageAlt("");
  };

  return (
    <div className="qe-toolbar-wrap">
      <div className="qe-toolbar" role="toolbar" aria-label="Formatting">
        <div className="qe-group">
          <Btn label="Undo" title="Undo (Ctrl+Z)" disabled={!state.canUndo} onClick={() => chain().undo().run()}>
            <Icon d="M5 4L2 7l3 3M2.5 7H10a4 4 0 010 8H8" />
          </Btn>
          <Btn label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!state.canRedo} onClick={() => chain().redo().run()}>
            <Icon d="M11 4l3 3-3 3M13.5 7H6a4 4 0 000 8h2" />
          </Btn>
        </div>
        <div className="qe-group">
          <select className="qe-select" aria-label="Text style" value={state.block} onChange={(e) => setBlock(e.target.value)}>
            <option value="" disabled>
              Text style
            </option>
            <option value="p">Paragraph</option>
            <option value="h2">Heading</option>
            <option value="h3">Subheading</option>
            <option value="h4">Small heading</option>
            <option value="h1">Title (H1)</option>
          </select>
        </div>
        <div className="qe-group">
          <Btn label="Bold" title="Bold (Ctrl+B)" active={state.bold} onClick={() => chain().toggleBold().run()}>
            <b>B</b>
          </Btn>
          <Btn label="Italic" title="Italic (Ctrl+I)" active={state.italic} onClick={() => chain().toggleItalic().run()}>
            <i>I</i>
          </Btn>
          <Btn label="Strikethrough" active={state.strike} onClick={() => chain().toggleStrike().run()}>
            <s>S</s>
          </Btn>
          <Btn label="Inline code" title="Inline code (Ctrl+E)" active={state.code} onClick={() => chain().toggleCode().run()}>
            <Icon d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5" />
          </Btn>
          <Btn label="Key" title="Keyboard key (Ctrl+Shift+K)" active={state.kbd} onClick={() => chain().toggleKbd().run()} />
          <Btn label="Link" title="Link" active={state.link || linkOpen} onClick={openLink}>
            <Icon d="M7 9a3 3 0 004.2.3l2-2a3 3 0 00-4.2-4.2l-1 1M9 7a3 3 0 00-4.2-.3l-2 2a3 3 0 004.2 4.2l1-1" />
          </Btn>
        </div>
        <div className="qe-group">
          <Btn label="Bulleted list" active={state.bullet && !state.checklist} onClick={() => chain().toggleBulletList().run()}>
            <Icon d="M6 4h8M6 8h8M6 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01" />
          </Btn>
          <Btn label="Numbered list" active={state.ordered} onClick={() => chain().toggleOrderedList().run()}>
            <Icon d="M7 4h7M7 8h7M7 12h7M2 3l1-.5V6M2 10h2l-2 2.5h2" />
          </Btn>
          <Btn label="Checklist" active={state.checklist} onClick={toggleChecklist}>
            <Icon d="M2 3.5h3v3H2zM2 9.5h3v3H2zM7 5h7M7 11h7" />
          </Btn>
          <Btn label="Quote" active={state.quote} onClick={() => chain().toggleBlockquote().run()}>
            <Icon d="M3 4v8M6 5h7M6 8h7M6 11h5" />
          </Btn>
          <Btn label="Code block" active={state.codeBlock} onClick={() => chain().toggleCodeBlock().run()}>
            <Icon d="M2 3h12v10H2zM5 6.5L6.5 8 5 9.5M8 10h3" />
          </Btn>
          <Btn label="Divider" onClick={() => chain().setHorizontalRule().run()}>
            <Icon d="M2 8h12" />
          </Btn>
        </div>
        <div className="qe-group">
          <Btn label="Note" title="Note callout" onClick={() => wrapOrInsert(editor, "callout", { kind: "note" }, [para("Something useful to know.")])} />
          <Btn label="Tip" title="Tip callout" onClick={() => wrapOrInsert(editor, "callout", { kind: "tip" }, [para("A quicker way.")])} />
          <Btn label="Warning" title="Warning callout" onClick={() => wrapOrInsert(editor, "callout", { kind: "warning" }, [para("What could go wrong.")])} />
          <Btn label="Important" title="Important callout" onClick={() => wrapOrInsert(editor, "callout", { kind: "danger" }, [para("What readers must not miss.")])} />
        </div>
        <div className="qe-group">
          <Btn label="Steps" onClick={() => wrapOrInsert(editor, "steps", {}, STEPS_TEMPLATE)} />
          <Btn label="Tabs" onClick={() => chain().insertContent(TABS_TEMPLATE).run()} />
          <Btn label="Question" title="Question and answer (opens on click)" onClick={() => wrapOrInsert(editor, "accordion", { label: "The question" }, [para("The answer.")])} />
          <Btn label="Link list" title="List of links with descriptions" onClick={() => wrapOrInsert(editor, "linkList", {}, [{ type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Page title", marks: [{ type: "link", attrs: { href: "/page" } }] }, { type: "text", text: ": what it covers." }] }] }] }])} />
          <Btn label="Table" onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
        </div>
        <div className="qe-group">
          <Btn label="Upload image or video" title="Upload an image or video" onClick={() => fileInput.current?.click()}>
            <Icon d="M2 3h12v10H2zM2 11l4-4 3 3 2-2 3 3M10.5 6h.01" />
          </Btn>
          <Btn
            label="Image from address"
            title="Image from an address"
            active={imageOpen}
            onClick={() => {
              setLinkOpen(false);
              setImageOpen((o) => !o);
            }}
          >
            <Icon d="M2 3h12v10H2zM6 9l2-2 2 2M8 7v4" />
          </Btn>
          <input ref={fileInput} type="file" accept="image/*,video/mp4,video/webm" multiple hidden onChange={(e) => onFiles(e.target.files)} />
        </div>
      </div>

      {state.table ? (
        <div className="qe-toolbar qe-subbar" role="toolbar" aria-label="Table">
          <span className="qe-subbar-label">Table</span>
          <Btn label="Row above" onClick={() => chain().addRowBefore().run()} />
          <Btn label="Row below" onClick={() => chain().addRowAfter().run()} />
          <Btn label="Column left" onClick={() => chain().addColumnBefore().run()} />
          <Btn label="Column right" onClick={() => chain().addColumnAfter().run()} />
          <Btn label="Delete row" onClick={() => chain().deleteRow().run()} />
          <Btn label="Delete column" onClick={() => chain().deleteColumn().run()} />
          <Btn label="Delete table" onClick={() => chain().deleteTable().run()} />
        </div>
      ) : null}

      {linkOpen ? (
        <form
          className="qe-toolbar qe-subbar"
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
        >
          <label className="qe-subbar-label" htmlFor="qe-href">
            Link to
          </label>
          <input id="qe-href" className="a-input qe-sub-input" autoFocus placeholder="/page-address or https://…" value={href} onChange={(e) => setHref(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setLinkOpen(false)} />
          <button className="a-btn a-btn-small a-btn-primary" type="submit">
            {href.trim() ? "Apply" : "Remove link"}
          </button>
          {state.link ? (
            <button className="a-btn a-btn-small" type="button" onClick={() => (chain().extendMarkRange("link").unsetLink().run(), setLinkOpen(false))}>
              Remove link
            </button>
          ) : null}
          <button className="a-btn a-btn-small" type="button" onClick={() => setLinkOpen(false)}>
            Cancel
          </button>
        </form>
      ) : null}

      {imageOpen ? (
        <form
          className="qe-toolbar qe-subbar"
          onSubmit={(e) => {
            e.preventDefault();
            addImageByUrl();
          }}
        >
          <label className="qe-subbar-label" htmlFor="qe-img">
            Image
          </label>
          <input id="qe-img" className="a-input qe-sub-input" autoFocus placeholder="/uploads/picture.png or https://…" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
          <input className="a-input qe-sub-input" aria-label="Description for screen readers" placeholder="Description (alt text)" value={imageAlt} onChange={(e) => setImageAlt(e.target.value)} />
          <button className="a-btn a-btn-small a-btn-primary" type="submit" disabled={!imageUrl.trim()}>
            Insert
          </button>
          <button className="a-btn a-btn-small" type="button" onClick={() => setImageOpen(false)}>
            Cancel
          </button>
        </form>
      ) : null}
    </div>
  );
}

export default function VisualEditor({ markdown, onChange, upload, onUnsupported, onError, flushRef, header }: Props) {
  // Parsed once: the editor owns the document from here, and reports Markdown back on each change.
  const initial = useMemo(() => {
    try {
      return markdownToDoc(markdown);
    } catch {
      return null;
    }
  }, []);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const uploadRef = useRef(upload);
  uploadRef.current = upload;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    enableContentCheck: true,
    onContentError: ({ error }) => onUnsupported(`This page has Markdown the visual editor can't show (${error.message}). It is open in Markdown mode instead.`),
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        codeBlock: false,
        listItem: false,
        underline: false,
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: null, target: null } },
      }),
      QuillListItem,
      QuillCodeBlock,
      MarkdownDetails,
      QuillTable,
      TableRow,
      QuillTableHeader,
      QuillTableCell,
      QuillImage,
      Kbd,
      Callout,
      Steps,
      LinkList,
      Accordion,
      Tabs,
      Tab,
      Video,
      RawBlock,
      RawInline,
      Placeholder.configure({ placeholder: "Start writing, or pick a block from the toolbar." }),
    ],
    content: initial ?? undefined,
    editorProps: {
      attributes: { class: "prose qe-content", "aria-label": "Page content", spellcheck: "true" },
      // Clicking a checklist item's box ticks it.
      handleClickOn: (view, _pos, node, nodePos, event) => {
        if (node.type.name !== "listItem" || node.attrs.checked === null || event.target !== view.nodeDOM(nodePos)) return false;
        view.dispatch(view.state.tr.setNodeMarkup(nodePos, undefined, { ...node.attrs, checked: !node.attrs.checked }));
        return true;
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => /^(image|video)\//.test(f.type));
        if (!files.length) return false;
        event.preventDefault();
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.from;
        (async () => {
          for (const f of files) {
            try {
              const up = await uploadRef.current(f);
              const node = f.type.startsWith("video/")
                ? view.state.schema.nodes.video.create({ src: up.url })
                : view.state.schema.nodes.image.create({ src: up.url, alt: f.name.replace(/\.[^.]+$/, "") });
              view.dispatch(view.state.tr.insert(Math.min(at, view.state.doc.content.size), node));
            } catch (e) {
              onError((e as Error).message);
            }
          }
        })();
        return true;
      },
    },
    onUpdate: ({ editor: e }) => {
      // Writing Markdown on every keystroke is wasted work on long pages.
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => onChangeRef.current(docToMarkdown(e.getJSON() as PMNode)), 150);
    },
  });

  useEffect(() => {
    if (!initial) onUnsupported("This page has Markdown the visual editor can't read. It is open in Markdown mode instead.");
  }, []);

  useEffect(() => {
    const flush = () => {
      if (!editor || editor.isDestroyed || !timer.current) return null;
      clearTimeout(timer.current);
      timer.current = null;
      const md = docToMarkdown(editor.getJSON() as PMNode);
      onChangeRef.current(md);
      return md;
    };
    if (flushRef) flushRef.current = flush;
    // Leaving visual mode keeps anything typed in the last moment.
    return () => {
      flush();
      if (flushRef) flushRef.current = null;
    };
  }, [editor, flushRef]);

  if (!editor) return <div className="qe-loading">Loading the editor…</div>;
  return (
    <div className="qe">
      <Toolbar editor={editor} upload={upload} onError={onError} />
      {/* The page column is as wide as on the site, so pictures, tables and lines look as readers will see them. */}
      <div className="qe-surface">
        <div className="qe-page">
          {header}
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
