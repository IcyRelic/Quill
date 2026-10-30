import Link from "next/link";
import { getSite, listPages } from "@/lib/content";
import { groupSlugs } from "@/lib/nav";
import PagesTable from "@/components/admin/PagesTable";

export default async function PagesScreen() {
  const [site, pages] = await Promise.all([getSite(), listPages({ includeDrafts: true })]);
  const groupOf = Object.fromEntries(site.navigation.flatMap((g) => groupSlugs(g).map((s) => [s, g.title])));
  const rows = pages.map(({ body: _body, previewToken: _token, ...p }) => ({ ...p, group: groupOf[p.slug] ?? null }));
  const drafts = rows.filter((r) => r.draft).length;
  const loose = rows.filter((r) => !r.group).length;
  return (
    <>
      <div className="a-head">
        <div>
          <h1>Pages</h1>
          <p className="a-sub">
            {rows.length} pages, {drafts} {drafts === 1 ? "draft" : "drafts"}
            {loose ? `, ${loose} not in the navigation` : ""}
          </p>
        </div>
        <div className="a-head-actions">
          <Link className="a-btn a-btn-primary" href="/admin/pages/edit">
            New page
          </Link>
        </div>
      </div>
      <PagesTable rows={rows} />
    </>
  );
}
