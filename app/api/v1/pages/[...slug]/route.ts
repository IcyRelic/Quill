import { getPage, savePage, deletePage, renamePage, placeInNav, resetPreviewToken, ContentError } from "@/lib/content";
import { getCaller } from "@/lib/auth";
import { renderMarkdown } from "@/lib/markdown";
import { handle, json, requireWriter, body, refreshSite, slugFrom, pageForApi } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string[] }> };
type Input = { title?: string; description?: string; body?: string; appendBody?: string; draft?: boolean; group?: string; folder?: string; position?: number; newSlug?: string; resetPreview?: boolean };

/** Read one page. Add ?html=1 to also get the rendered HTML and table of contents. */
export const GET = handle(async (req: Request, ctx: Ctx) => {
  const slug = slugFrom((await ctx.params).slug);
  const page = await getPage(slug);
  const caller = await getCaller(req);
  if (!page || (page.draft && !caller)) throw new ContentError(`No page at "${slug}".`, 404);
  const wantHtml = new URL(req.url).searchParams.get("html");
  const out = await pageForApi(req, caller, page);
  return json({ page: wantHtml ? { ...out, ...(await renderMarkdown(page.body)) } : out });
});

/** Create or fully replace a page. */
export const PUT = handle(async (req: Request, ctx: Ctx) => {
  const caller = await requireWriter(req);
  const slug = slugFrom((await ctx.params).slug);
  const b = await body<Input>(req);
  const existed = !!(await getPage(slug));
  const page = await savePage(slug, { title: b.title ?? "", description: b.description, body: b.body, draft: b.draft, updatedBy: caller.name, resetPreview: b.resetPreview });
  if (b.group) await placeInNav(slug, b.group, b.position, b.folder);
  refreshSite();
  return json({ page: await pageForApi(req, caller, page) }, existed ? 200 : 201);
});

/**
 * Change some fields. `appendBody` adds Markdown to the end; `newSlug` moves the page and its place in the
 * navigation (the preview link moves with it); `resetPreview` makes a new preview link.
 */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const caller = await requireWriter(req);
  let slug = slugFrom((await ctx.params).slug);
  const b = await body<Input>(req);
  const cur = await getPage(slug);
  if (!cur) throw new ContentError(`No page at "${slug}".`, 404);
  // Only a new preview link: not an edit, so the page's updated time and author stay.
  if (b.resetPreview && Object.keys(b).every((k) => k === "resetPreview")) {
    return json({ page: await pageForApi(req, caller, await resetPreviewToken(slug)) });
  }
  if (b.newSlug && b.newSlug !== slug) {
    await renamePage(slug, b.newSlug, caller.name);
    slug = b.newSlug;
  }
  const nextBody = b.body ?? cur.body;
  const page = await savePage(slug, {
    title: b.title ?? cur.title,
    description: b.description ?? cur.description,
    body: b.appendBody ? `${nextBody.trimEnd()}\n\n${b.appendBody.trim()}` : nextBody,
    draft: b.draft ?? cur.draft,
    updatedBy: caller.name,
    resetPreview: b.resetPreview,
  });
  if (b.group) await placeInNav(slug, b.group, b.position, b.folder);
  refreshSite();
  return json({ page: await pageForApi(req, caller, page) });
});

export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  await requireWriter(req);
  const slug = slugFrom((await ctx.params).slug);
  await deletePage(slug);
  refreshSite();
  return json({ deleted: slug });
});
