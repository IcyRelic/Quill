import { getSite, getNavigation, listPages } from "@/lib/content";
import { publicOrigin } from "@/lib/api";

export const dynamic = "force-dynamic";

/** A plain-text map of the docs for language models (https://llmstxt.org). */
export async function GET(req: Request) {
  const origin = await publicOrigin(req);
  const [site, nav, pages] = await Promise.all([getSite(), getNavigation(), listPages()]);
  const desc = new Map(pages.map((p) => [p.slug, p.description]));
  const lines = [`# ${site.name}`, "", `> ${site.description}`, ""];
  for (const g of nav) {
    lines.push(`## ${g.title}`, "");
    for (const i of g.items) lines.push(`- [${i.title}](${origin}/api/v1/pages/${i.slug}): ${desc.get(i.slug) ?? ""}`);
    lines.push("");
  }
  lines.push("## API", "", `- OpenAPI description: ${origin}/api/v1/openapi.json`, `- Write access: Authorization: Bearer <key>`, "");
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
