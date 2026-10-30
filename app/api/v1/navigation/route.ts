import { getSite, saveSite, getNavigation, ContentError } from "@/lib/content";
import { cleanNavigation } from "@/lib/nav";
import { getCaller } from "@/lib/auth";
import { handle, json, requireWriter, body, refreshSite } from "@/lib/api";

export const dynamic = "force-dynamic";

/** The sidebar: groups in order, each with its pages and dropdowns in order (titles resolved). */
export const GET = handle(async (req: Request) => {
  const includeDrafts = !!(await getCaller(req));
  return json({ navigation: (await getSite()).navigation, resolved: await getNavigation({ includeDrafts }) });
});

/**
 * Replace the sidebar. Body:
 * { "navigation": [{ "title": "Guides", "pages": ["guides/export", { "title": "Components", "pages": ["components/tabs"] }] }] }
 */
export const PUT = handle(async (req: Request) => {
  await requireWriter(req);
  const clean = cleanNavigation((await body<{ navigation?: unknown }>(req)).navigation);
  if (!clean) {
    throw new ContentError('Send { "navigation": [{ "title": "Group name", "pages": ["page-slug", { "title": "Dropdown", "pages": ["page-slug"] }] }] }.');
  }
  const site = await getSite();
  site.navigation = clean;
  await saveSite(site);
  refreshSite();
  return json({ navigation: clean });
});
