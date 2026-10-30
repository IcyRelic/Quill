import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isAdmin } from "@/lib/auth";
import { getSite, listPages } from "@/lib/content";
import { withBase } from "@/lib/basePath";
import AdminNav from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export default async function Panel({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) {
    const path = (await headers()).get("x-quill-path") ?? "/admin";
    redirect(`/admin/login?next=${encodeURIComponent(path)}`);
  }
  const [site, pages] = await Promise.all([getSite(), listPages({ includeDrafts: true })]);
  return (
    <div className="a-app">
      {/* The site's own top bar: the same wordmark, with the admin actions on the right. */}
      <header className="topbar a-topbar">
        <Link className="wordmark" href="/admin">
          <img src={withBase(site.logo)} alt="" width="28" height="28" />
          <span>{site.name}</span>
          {site.tagline ? <span className="wordmark-sub">{site.tagline}</span> : null}
        </Link>
        <span className="a-topbar-tag">Admin</span>
        <div className="a-topbar-actions">
          <a className="a-btn" href={withBase("/")} target="_blank" rel="noreferrer">
            View site
          </a>
          <form method="post" action={withBase("/api/auth/logout")}>
            <button className="a-btn" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <AdminNav pageCount={pages.length} draftCount={pages.filter((p) => p.draft).length} />
      <main className="a-main">{children}</main>
    </div>
  );
}
