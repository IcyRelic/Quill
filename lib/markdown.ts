import { unified, type Processor } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeShiki from "@shikijs/rehype";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import { toString as hastToString } from "hast-util-to-string";
import type { Root as MdRoot, RootContent, Paragraph, PhrasingContent } from "mdast";
import type { Root as HastRoot, Element } from "hast";
import { withBase } from "./basePath";

export type TocItem = { id: string; text: string; depth: 2 | 3 };
export type Rendered = { html: string; toc: TocItem[] };

const CALLOUTS: Record<string, string> = { note: "Note", info: "Note", tip: "Tip", warning: "Warning", danger: "Important" };

type DirectiveNode = {
  type: "containerDirective" | "leafDirective" | "textDirective";
  name: string;
  attributes?: Record<string, string | null | undefined>;
  children: RootContent[];
  data?: Record<string, unknown>;
};

const isDirective = (n: unknown): n is DirectiveNode =>
  !!n && typeof n === "object" && ["containerDirective", "leafDirective", "textDirective"].includes((n as { type: string }).type);

/** Splits off a container directive's [label], returning it as phrasing content. */
function takeLabel(node: DirectiveNode): PhrasingContent[] | null {
  const first = node.children[0] as Paragraph | undefined;
  if (first && first.type === "paragraph" && (first.data as { directiveLabel?: boolean } | undefined)?.directiveLabel) {
    node.children.shift();
    return first.children;
  }
  return null;
}

const el = (tag: string, props: Record<string, unknown>, children: unknown[]) =>
  ({ type: "quillBlock", data: { hName: tag, hProperties: props }, children }) as unknown as RootContent;

const text = (value: string) => ({ type: "text", value }) as RootContent;

function remarkQuillDirectives() {
  return (tree: MdRoot) => {
    let uid = 0;
    // Children first, so a callout inside a step or a tab is already converted when its parent moves it.
    const walk = (parent: { children: RootContent[] }) => {
      for (let i = 0; i < parent.children.length; i++) {
        const child = parent.children[i] as RootContent & { children?: RootContent[] };
        if (Array.isArray(child.children)) walk(child as { children: RootContent[] });
        if (isDirective(child)) {
          const r = convert(child);
          if (r) parent.children[i] = r;
        }
      }
    };
    const convert = (node: DirectiveNode): RootContent | null => {
      const name = node.name.toLowerCase();
      const attrs = node.attributes ?? {};
      let replacement: RootContent | null = null;

      if (node.type === "textDirective") {
        if (name === "kbd") replacement = el("kbd", {}, node.children);
        else replacement = text(`:${node.name}`);
      } else if (node.type === "leafDirective") {
        if (name === "video" && attrs.src) {
          replacement = el("video", { src: attrs.src, controls: true, muted: true, playsInline: true, preload: "metadata", className: ["doc-video"], title: attrs.title ?? undefined }, []);
        } else return null;
      } else if (name in CALLOUTS) {
        const label = takeLabel(node);
        replacement = el("aside", { className: ["callout", `callout-${name}`], role: "note" }, [
          el("p", { className: ["callout-title"] }, label ?? [text(CALLOUTS[name])]),
          el("div", { className: ["callout-body"] }, node.children),
        ]);
      } else if (name === "steps") {
        takeLabel(node);
        const items: RootContent[][] = [];
        for (const child of node.children) {
          // Step titles stay out of "On this page".
          if (child.type === "heading") child.data = { ...child.data, hProperties: { ...(child.data?.hProperties ?? {}), dataNoToc: "" } };
          if (child.type === "heading" || items.length === 0) items.push([]);
          items[items.length - 1].push(child);
        }
        replacement = el(
          "ol",
          { className: ["steps"] },
          items.map((children) => el("li", { className: ["step"] }, children)),
        );
      } else if (name === "tabs") {
        takeLabel(node);
        const tabs = node.children.filter((c): c is DirectiveNode & RootContent => isDirective(c) && c.name.toLowerCase() === "tab");
        const id = `tabs-${++uid}`;
        const labels = tabs.map((t, i) => {
          const l = takeLabel(t);
          return l ?? [text(t.attributes?.title ?? `Option ${i + 1}`)];
        });
        replacement = el("div", { className: ["tabs"], dataTabs: "" }, [
          el(
            "div",
            { className: ["tab-list"], role: "tablist" },
            labels.map((l, i) =>
              el("button", { type: "button", role: "tab", id: `${id}-t${i}`, ariaControls: `${id}-p${i}`, ariaSelected: i === 0 ? "true" : "false", tabIndex: i === 0 ? 0 : -1 }, l),
            ),
          ),
          ...tabs.map((t, i) =>
            el("div", { className: ["tab-panel"], role: "tabpanel", id: `${id}-p${i}`, ariaLabelledby: `${id}-t${i}`, dataActive: i === 0 ? "true" : "false" }, [
              el("p", { className: ["tab-panel-label"] }, labels[i]),
              ...t.children,
            ]),
          ),
        ]);
      } else if (name === "accordion" || name === "details") {
        const label = takeLabel(node);
        replacement = el("details", { className: ["accordion"] }, [el("summary", {}, label ?? [text(attrs.title ?? "Details")]), el("div", { className: ["accordion-body"] }, node.children)]);
      } else if (name === "links") {
        takeLabel(node);
        // "- [Title](/page): description" reads as a card; drop the colon that separates the two.
        visit(node as unknown as MdRoot, "link", (_link, i, parent) => {
          const after = parent && i !== undefined ? parent.children[i + 1] : undefined;
          if (after?.type === "text") after.value = after.value.replace(/^\s*[:–—-]\s*/, "");
        });
        replacement = el("nav", { className: ["link-list"], ariaLabel: attrs.title ?? "Related pages" }, node.children);
      } else {
        return null;
      }
      return replacement;
    };
    walk(tree as unknown as { children: RootContent[] });
  };
}

/** Root-relative links and media in content, such as /quickstart or /uploads/a.png, point inside Quill even under a base path. */
function rehypeBasePath() {
  return (tree: HastRoot) => {
    visit(tree, "element", (node: Element) => {
      for (const attr of ["href", "src", "poster"]) {
        const v = node.properties?.[attr];
        if (typeof v === "string") node.properties[attr] = withBase(v);
      }
    });
  };
}

function rehypeCollectToc() {
  return (tree: HastRoot, file: { data: Record<string, unknown> }) => {
    const toc: TocItem[] = [];
    visit(tree, "element", (node: Element) => {
      if ((node.tagName === "h2" || node.tagName === "h3") && node.properties?.id && node.properties.dataNoToc === undefined) {
        toc.push({ id: String(node.properties.id), text: hastToString(node), depth: node.tagName === "h2" ? 2 : 3 });
      }
      // External links open in a new tab.
      if (node.tagName === "a" && typeof node.properties?.href === "string" && /^https?:\/\//.test(node.properties.href)) {
        node.properties.target = "_blank";
        node.properties.rel = ["noopener", "noreferrer"];
      }
      if (node.tagName === "img") {
        node.properties.loading = "lazy";
        node.properties.decoding = "async";
      }
      if (node.tagName === "table") {
        // Wide tables scroll inside their own box on phones.
        node.properties.className = ["doc-table"];
      }
    });
    file.data.toc = toc;
  };
}

let processor: Processor | null = null;

function getProcessor() {
  if (!processor) {
    processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkDirective)
      .use(remarkQuillDirectives)
      .use(remarkRehype)
      .use(rehypeSlug)
      .use(rehypeShiki, {
        theme: "github-dark-default",
        langs: ["bash", "shell", "powershell", "javascript", "typescript", "json", "html", "css", "markdown", "yaml", "python"],
        defaultLanguage: "text",
        fallbackLanguage: "text",
      })
      .use(rehypeCollectToc)
      .use(rehypeBasePath)
      .use(rehypeStringify) as unknown as Processor;
  }
  return processor;
}

export async function renderMarkdown(source: string): Promise<Rendered> {
  const file = await getProcessor().process(source);
  return { html: String(file), toc: (file.data.toc as TocItem[]) ?? [] };
}

/** Plain text of a markdown body, for search and descriptions. */
export function plainText(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^:{2,}\w*(\[[^\]]*\])?(\{[^}]*\})?\s*$/gm, " ")
    .replace(/:(\w+)\[([^\]]*)\]/g, "$2")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`|~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Questions and answers from a page made of :::accordion blocks (used by the home page). */
export function extractQuestions(md: string) {
  const out: { q: string; a: string }[] = [];
  const re = /^:::(?:accordion|details)\[([^\]]+)\]\s*\n([\s\S]*?)^:::\s*$/gm;
  for (const m of md.matchAll(re)) out.push({ q: m[1].trim(), a: m[2].trim() });
  return out;
}
