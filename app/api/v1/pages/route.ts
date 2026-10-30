import { listPages, getPage, savePage, placeInNav, ContentError } from "@/lib/content";
import { getCaller } from "@/lib/auth";
import { handle, json, requireWriter, body, refreshSite, pageForApi } from "@/lib/api";

export const dynamic = "force-dynamic";

/** List pages. Drafts are included for callers with a key or an admin session. */
export const GET = handle(async (req: Request) => {
  const caller = await getCaller(req);
  const pages = await listPages({ includeDrafts: !!caller });
  return json({ pages: await Promise.all(pages.map(({ body: _body, ...meta }) => pageForApi(req, caller, meta))) });
});

/** Create a page. Fails with 409 if the slug is taken (PUT /pages/{slug} creates or replaces). */
export const POST = handle(async (req: Request) => {
  const caller = await requireWriter(req);
  const b = await body<{ slug?: string; title?: string; description?: string; body?: string; draft?: boolean; group?: string; folder?: string; position?: number }>(req);
  if (!b.slug) throw new ContentError('Send a slug, for example "guides/export-a-pdf".');
  if (await getPage(b.slug)) throw new ContentError(`A page already exists at "${b.slug}".`, 409);
  const page = await savePage(b.slug, { title: b.title ?? "", description: b.description, body: b.body, draft: b.draft, updatedBy: caller.name });
  if (b.group) await placeInNav(page.slug, b.group, b.position, b.folder);
  refreshSite();
  return json({ page: await pageForApi(req, caller, page) }, 201);
});
