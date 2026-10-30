import { notFound } from "next/navigation";
import { getPage, getSite } from "@/lib/content";
import { getSessionUser } from "@/lib/auth";
import { groupOf } from "@/lib/nav";
import Editor from "@/components/admin/Editor";

export default async function EditScreen({ searchParams }: { searchParams: Promise<{ slug?: string }> }) {
  const { slug } = await searchParams;
  const [site, user] = await Promise.all([getSite(), getSessionUser()]);
  const page = slug ? await getPage(slug) : null;
  if (slug && !page) notFound();
  const group = page ? (groupOf(site.navigation, page.slug) ?? "") : (site.navigation[0]?.title ?? "");
  return <Editor key={slug ?? "new"} initial={page} initialGroup={group} groups={site.navigation.map((g) => g.title)} userName={user?.name ?? ""} />;
}
