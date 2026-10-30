/**
 * Markdown <-> visual editor document.
 *
 * Both directions go through the same parser the site renders with (remark + GFM + directives), so the
 * visual editor sees a page the way readers do. Anything the editor has no block for (raw HTML, footnotes,
 * reference links, unknown directives) is kept as its original Markdown in a "raw" node and written back
 * unchanged.
 */
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import remarkStringify from "remark-stringify";
import type { Root, RootContent, PhrasingContent, Paragraph, ListItem, TableRow, AlignType, HeadingData } from "mdast";

export type PMMark = { type: string; attrs?: Record<string, unknown> };
export type PMNode = { type: string; attrs?: Record<string, unknown>; content?: PMNode[]; marks?: PMMark[]; text?: string };

type Attrs = Record<string, string | null | undefined>;
type Directive = {
  type: "containerDirective" | "leafDirective" | "textDirective";
  name: string;
  attributes?: Attrs | null;
  children: RootContent[];
};

export const CALLOUT_KINDS = ["note", "info", "tip", "warning", "danger"] as const;
const CALLOUTS = new Set<string>(CALLOUT_KINDS);

const processor = unified()
  .use(remarkParse)
  // Every cell "measures" 3, so cells aren't padded and the rule under the header reads | --- |, as people write it.
  .use(remarkGfm, { stringLength: () => 3 })
  .use(remarkDirective)
  .use(remarkStringify, {
    bullet: "-",
    emphasis: "*",
    strong: "*",
    fence: "`",
    fences: true,
    rule: "-",
    listItemIndent: "one",
    incrementListMarker: true,
    // A heading written directly above its text (common in steps) stays that way.
    // Tabs in a tab group sit on consecutive lines too.
    join: [
      (left, _right, parent) =>
        (left.data as { tight?: boolean } | undefined)?.tight || (parent.type === "containerDirective" && (parent as unknown as Directive).name === "tabs") ? 0 : undefined,
    ],
  });

const parse = (md: string) => processor.parse(md) as Root;
const stringify = (root: Root) => processor.stringify(root) as string;

// ---------- Markdown -> document ----------

const emptyParagraph = (): PMNode => ({ type: "paragraph" });
const orEmpty = (blocks: PMNode[]) => (blocks.length ? blocks : [emptyParagraph()]);
const cleanAttrs = (a: Attrs | null | undefined) => Object.fromEntries(Object.entries(a ?? {}).filter(([, v]) => v !== undefined)) as Record<string, string | null>;

/** Takes a container directive's [label] off its children, as Markdown text. */
function takeLabel(children: RootContent[]): [string | null, RootContent[]] {
  const first = children[0] as Paragraph | undefined;
  if (first?.type === "paragraph" && (first.data as { directiveLabel?: boolean } | undefined)?.directiveLabel) {
    return [phrasingToMarkdown(first.children), children.slice(1)];
  }
  return [null, children];
}

export function phrasingToMarkdown(children: PhrasingContent[]) {
  return stringify({ type: "root", children: [{ type: "paragraph", children }] }).trim();
}

function markdownToPhrasing(md: string): PhrasingContent[] {
  const first = parse(md).children[0];
  return first?.type === "paragraph" ? first.children : [{ type: "text", value: md }];
}

export function markdownToDoc(md: string): PMNode {
  const slice = (n: { position?: { start: { offset?: number }; end: { offset?: number } } }) =>
    n.position?.start.offset !== undefined && n.position.end.offset !== undefined ? md.slice(n.position.start.offset, n.position.end.offset) : "";
  const raw = (n: RootContent): PMNode => ({ type: "rawBlock", attrs: { source: slice(n) } });

  const inline = (nodes: PhrasingContent[], marks: PMMark[]): PMNode[] =>
    nodes.flatMap((n): PMNode[] => {
      const m = marks.length ? { marks } : {};
      switch (n.type) {
        case "text":
          return n.value ? [{ type: "text", text: n.value, ...m }] : [];
        case "strong":
          return inline(n.children, [...marks, { type: "bold" }]);
        case "emphasis":
          return inline(n.children, [...marks, { type: "italic" }]);
        case "delete":
          return inline(n.children, [...marks, { type: "strike" }]);
        case "inlineCode":
          return [{ type: "text", text: n.value || " ", marks: [...marks, { type: "code" }] }];
        case "link":
          return inline(n.children, [...marks, { type: "link", attrs: { href: n.url, title: n.title ?? null } }]);
        case "image":
          return [{ type: "image", attrs: { src: n.url, alt: n.alt ?? "", title: n.title ?? null }, ...m }];
        case "break":
          return [{ type: "hardBreak", ...m }];
        case "html":
          return [{ type: "rawInline", attrs: { source: n.value }, ...m }];
        default: {
          const d = n as unknown as Directive;
          if (d.type === "textDirective" && d.name.toLowerCase() === "kbd" && !Object.keys(d.attributes ?? {}).length) {
            return inline(d.children as PhrasingContent[], [...marks, { type: "kbd" }]);
          }
          return [{ type: "rawInline", attrs: { source: slice(n) }, ...m }];
        }
      }
    });

  const directive = (d: Directive, n: RootContent): PMNode => {
    const name = d.name.toLowerCase();
    const attributes = cleanAttrs(d.attributes);
    if (d.type === "leafDirective") {
      if (name === "video" && attributes.src) {
        const { src, title, ...rest } = attributes;
        return { type: "video", attrs: { src, title: title ?? null, attributes: rest } };
      }
      return raw(n);
    }
    if (d.type !== "containerDirective") return raw(n);
    const [label, rest] = takeLabel(d.children);
    if (CALLOUTS.has(name)) return { type: "callout", attrs: { kind: name, label, attributes }, content: orEmpty(blocks(rest)) };
    if (name === "steps") return { type: "steps", attrs: { label, attributes }, content: orEmpty(blocks(rest)) };
    if (name === "links") return { type: "linkList", attrs: { label, attributes }, content: orEmpty(blocks(rest)) };
    if (name === "accordion" || name === "details") return { type: "accordion", attrs: { name, label, attributes }, content: orEmpty(blocks(rest)) };
    if (name === "tabs") {
      const tabs = rest as unknown as Directive[];
      // Only tabs belong in a tab group; anything else there is hidden on the site, so keep it as written.
      if (!tabs.length || !tabs.every((t) => t.type === "containerDirective" && t.name.toLowerCase() === "tab")) return raw(n);
      return {
        type: "tabs",
        attrs: { label, attributes },
        content: tabs.map((t) => {
          const [tabLabel, body] = takeLabel(t.children);
          return { type: "tab", attrs: { label: tabLabel, attributes: cleanAttrs(t.attributes) }, content: orEmpty(blocks(body)) };
        }),
      };
    }
    return raw(n);
  };

  const listItem = (item: ListItem): PMNode => ({
    type: "listItem",
    attrs: { checked: item.checked ?? null, spread: !!item.spread },
    content: orEmpty(blocks(item.children)),
  });

  const blocks = (nodes: RootContent[]): PMNode[] =>
    nodes.flatMap((n, i): PMNode[] => {
      switch (n.type) {
        case "paragraph": {
          const content = inline(n.children, []);
          return [content.length ? { type: "paragraph", content } : emptyParagraph()];
        }
        case "heading": {
          const content = inline(n.children, []);
          const next = nodes[i + 1];
          const tight = next?.type === "paragraph" && next.position?.start.line === (n.position?.end.line ?? -2) + 1;
          return [{ type: "heading", attrs: { level: n.depth, tight }, ...(content.length ? { content } : {}) }];
        }
        case "thematicBreak":
          return [{ type: "horizontalRule" }];
        case "blockquote":
          return [{ type: "blockquote", content: orEmpty(blocks(n.children)) }];
        case "list":
          return [
            n.ordered
              ? { type: "orderedList", attrs: { start: n.start ?? 1, spread: !!n.spread }, content: n.children.map(listItem) }
              : { type: "bulletList", attrs: { spread: !!n.spread }, content: n.children.map(listItem) },
          ];
        case "code":
          return [{ type: "codeBlock", attrs: { language: n.lang ?? null, meta: n.meta ?? null }, ...(n.value ? { content: [{ type: "text", text: n.value }] } : {}) }];
        case "html":
          return [{ type: "rawBlock", attrs: { source: n.value } }];
        case "table":
          return [
            {
              type: "table",
              attrs: { align: n.align ?? [] },
              content: n.children.map((row: TableRow, r) => ({
                type: "tableRow",
                content: row.children.map((cell) => {
                  const content = inline(cell.children, []);
                  return { type: r === 0 ? "tableHeader" : "tableCell", content: [content.length ? { type: "paragraph", content } : emptyParagraph()] };
                }),
              })),
            },
          ];
        case "containerDirective":
        case "leafDirective":
          return [directive(n as unknown as Directive, n)];
        default:
          return [raw(n)];
      }
    });

  return { type: "doc", content: orEmpty(blocks(parse(md).children)) };
}

// ---------- document -> Markdown ----------

/** Outermost first. Code is innermost because inline code can't hold other formatting. */
const MARK_ORDER = ["link", "kbd", "bold", "italic", "strike", "code"];

const sameMark = (a: PMMark, b: PMMark) => a.type === b.type && (a.type !== "link" || (a.attrs?.href === b.attrs?.href && (a.attrs?.title ?? null) === (b.attrs?.title ?? null)));
const textOf = (nodes: PMNode[] = []): string => nodes.map((n) => n.text ?? (n.type === "hardBreak" ? "\n" : textOf(n.content))).join("");

function inlineOut(nodes: PMNode[] = []): PhrasingContent[] {
  const out: PhrasingContent[] = [];
  let i = 0;
  while (i < nodes.length) {
    const n = nodes[i];
    const mark = MARK_ORDER.map((t) => n.marks?.find((m) => m.type === t)).find(Boolean);
    if (!mark) {
      out.push(...leaf(n));
      i++;
      continue;
    }
    let j = i;
    while (j < nodes.length && nodes[j].marks?.some((m) => sameMark(m, mark))) j++;
    const inner = nodes.slice(i, j).map((x) => ({ ...x, marks: x.marks?.filter((m) => !sameMark(m, mark)) }));
    out.push(wrap(mark, inner));
    i = j;
  }
  // Neighbouring plain text becomes one node, so escaping looks at whole words.
  return out.reduce<PhrasingContent[]>((acc, n) => {
    const last = acc[acc.length - 1];
    if (n.type === "text" && last?.type === "text") last.value += n.value;
    else acc.push(n);
    return acc;
  }, []);
}

function leaf(n: PMNode): PhrasingContent[] {
  switch (n.type) {
    case "text":
      return [{ type: "text", value: n.text ?? "" }];
    case "hardBreak":
      return [{ type: "break" }];
    case "image":
      return [{ type: "image", url: String(n.attrs?.src ?? ""), alt: String(n.attrs?.alt ?? ""), title: (n.attrs?.title as string) || null }];
    case "rawInline":
      return [{ type: "html", value: String(n.attrs?.source ?? "") }];
    default:
      return [];
  }
}

function wrap(mark: PMMark, inner: PMNode[]): PhrasingContent {
  switch (mark.type) {
    case "code":
      return { type: "inlineCode", value: textOf(inner) };
    case "link":
      return { type: "link", url: String(mark.attrs?.href ?? ""), title: (mark.attrs?.title as string) || null, children: inlineOut(inner) };
    case "kbd":
      return { type: "textDirective", name: "kbd", attributes: {}, children: inlineOut(inner) } as unknown as PhrasingContent;
    case "bold":
      return { type: "strong", children: inlineOut(inner) };
    case "italic":
      return { type: "emphasis", children: inlineOut(inner) };
    default:
      return { type: "delete", children: inlineOut(inner) };
  }
}

const labelled = (label: unknown): RootContent[] =>
  typeof label === "string" && label.trim() ? [{ type: "paragraph", data: { directiveLabel: true }, children: markdownToPhrasing(label.trim()) } as Paragraph] : [];

const container = (name: string, attrs: Record<string, unknown> | undefined, children: RootContent[]): RootContent =>
  ({
    type: "containerDirective",
    name,
    attributes: (attrs?.attributes as Attrs) ?? {},
    children: [...labelled(attrs?.label), ...children],
  }) as unknown as RootContent;

function blocksOut(nodes: PMNode[] = []): RootContent[] {
  return nodes.flatMap((n): RootContent[] => {
    switch (n.type) {
      case "paragraph": {
        const children = inlineOut(n.content);
        // Markdown has no empty paragraphs.
        return children.length ? [{ type: "paragraph", children }] : [];
      }
      case "heading":
        return [
          {
            type: "heading",
            depth: Math.min(6, Math.max(1, Number(n.attrs?.level ?? 2))) as 1 | 2 | 3 | 4 | 5 | 6,
            children: inlineOut(n.content),
            ...(n.attrs?.tight ? { data: { tight: true } as HeadingData } : {}),
          },
        ];
      case "horizontalRule":
        return [{ type: "thematicBreak" }];
      case "blockquote":
        return [{ type: "blockquote", children: blocksOut(n.content) as never }];
      case "bulletList":
      case "orderedList":
        return [
          {
            type: "list",
            ordered: n.type === "orderedList",
            start: n.type === "orderedList" ? Number(n.attrs?.start ?? 1) : null,
            spread: !!n.attrs?.spread,
            children: (n.content ?? []).map(
              (item): ListItem => ({
                type: "listItem",
                spread: !!item.attrs?.spread,
                checked: typeof item.attrs?.checked === "boolean" ? item.attrs.checked : null,
                children: blocksOut(item.content) as never,
              }),
            ),
          },
        ];
      case "codeBlock":
        return [{ type: "code", lang: (n.attrs?.language as string) || null, meta: (n.attrs?.meta as string) || null, value: textOf(n.content) }];
      case "rawBlock":
        return [{ type: "html", value: String(n.attrs?.source ?? "") }];
      case "table": {
        const rows = n.content ?? [];
        const cols = Math.max(0, ...rows.map((r) => r.content?.length ?? 0));
        const align = (n.attrs?.align as AlignType[] | undefined) ?? [];
        return [
          {
            type: "table",
            align: Array.from({ length: cols }, (_, i) => align[i] ?? null),
            children: rows.map((r) => ({
              type: "tableRow",
              children: (r.content ?? []).map((cell) => ({
                type: "tableCell",
                // A Markdown table cell is one line: paragraphs inside a cell are joined with a line break.
                children: (cell.content ?? []).flatMap((p, k) => [...(k ? [{ type: "break" } as PhrasingContent] : []), ...inlineOut(p.content)]),
              })),
            })),
          },
        ];
      }
      case "callout":
        return [container(String(n.attrs?.kind ?? "note"), n.attrs, blocksOut(n.content))];
      case "steps":
        return [container("steps", n.attrs, blocksOut(n.content))];
      case "linkList":
        return [container("links", n.attrs, blocksOut(n.content))];
      case "accordion":
        return [container(String(n.attrs?.name ?? "accordion"), n.attrs, blocksOut(n.content))];
      case "tabs":
        return [container("tabs", n.attrs, (n.content ?? []).map((t) => container("tab", t.attrs, blocksOut(t.content))))];
      case "video": {
        const attributes: Attrs = { ...((n.attrs?.attributes as Attrs) ?? {}), src: String(n.attrs?.src ?? "") };
        if (n.attrs?.title) attributes.title = String(n.attrs.title);
        return [{ type: "leafDirective", name: "video", attributes, children: [] } as unknown as RootContent];
      }
      case "image":
      case "text":
        return [{ type: "paragraph", children: inlineOut([n]) }];
      default:
        return [];
    }
  });
}

export function docToMarkdown(doc: PMNode): string {
  return stringify({ type: "root", children: blocksOut(doc.content) }).trim() + "\n";
}
