import { getSite, listPages } from "@/lib/content";
import NavEditor from "@/components/admin/NavEditor";

export default async function NavigationScreen() {
  const [site, pages] = await Promise.all([getSite(), listPages({ includeDrafts: true })]);
  const titles = Object.fromEntries(pages.map((p) => [p.slug, { title: p.title, draft: p.draft }]));
  return <NavEditor initial={site.navigation} pages={titles} />;
}
