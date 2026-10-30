import { getSite, listPages } from "@/lib/content";
import HomeForm from "@/components/admin/HomeForm";

export default async function HomeScreen() {
  const [site, pages] = await Promise.all([getSite(), listPages({ includeDrafts: true })]);
  return <HomeForm initial={site} pages={pages.map((p) => ({ slug: p.slug, title: p.title }))} />;
}
