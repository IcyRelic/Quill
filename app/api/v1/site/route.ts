import { getSite, saveSite, patchSite, ContentError, type SiteConfig } from "@/lib/content";
import { cleanNavigation } from "@/lib/nav";
import { handle, json, requireWriter, body, refreshSite } from "@/lib/api";
import type { Caller } from "@/lib/auth";

/** What an editor account may change here. Everything else (name, links, appearance) needs an admin. */
const EDITOR_FIELDS = new Set(["home", "navigation"]);

function checkEditor(caller: Caller, fields: string[]) {
  if (caller?.kind === "user" && caller.role !== "admin" && fields.some((f) => !EDITOR_FIELDS.has(f))) {
    throw new ContentError("Editors can change the home page and navigation. Other settings need an admin.", 403);
  }
}

export const dynamic = "force-dynamic";

export const GET = handle(async () => json({ site: await getSite() }));

/** Replace the whole site settings object. */
export const PUT = handle(async (req: Request) => {
  const caller = await requireWriter(req);
  const next = await body<SiteConfig>(req);
  checkEditor(caller, Object.keys(next));
  if (!next.name || !Array.isArray(next.navigation) || !next.home) {
    throw new ContentError("A full site object needs at least name, navigation and home. Use PATCH to change a few fields.");
  }
  const navigation = cleanNavigation(next.navigation);
  if (!navigation) throw new ContentError("navigation is not in the right shape. See PUT /api/v1/navigation.");
  const site = await saveSite({ ...next, navigation });
  refreshSite();
  return json({ site });
});

/** Merge some fields into the site settings (objects such as home are merged one level deep). */
export const PATCH = handle(async (req: Request) => {
  const caller = await requireWriter(req);
  const patch = await body<Partial<SiteConfig>>(req);
  checkEditor(caller, Object.keys(patch));
  if (patch.navigation !== undefined) {
    const navigation = cleanNavigation(patch.navigation);
    if (!navigation) throw new ContentError("navigation is not in the right shape. See PUT /api/v1/navigation.");
    patch.navigation = navigation;
  }
  const site = await patchSite(patch);
  refreshSite();
  return json({ site });
});
