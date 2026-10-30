import { getSite, getNavigation } from "@/lib/content";
import { isAdmin } from "@/lib/auth";
import { withBase } from "@/lib/basePath";
import TopBar from "@/components/TopBar";
import Sidebar from "@/components/Sidebar";
import Enhance from "@/components/Enhance";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const admin = await isAdmin();
  const [site, nav] = await Promise.all([getSite(), getNavigation({ includeDrafts: admin })]);
  const copyright = site.copyright.replace("{year}", String(new Date().getFullYear()));
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <TopBar name={site.name} tagline={site.tagline} logo={site.logo} links={site.links} nav={nav} />
      <Sidebar nav={nav} />
      <div className="page">
        <main id="main">{children}</main>
        <footer className="footer">
          <p>{copyright}</p>
          {site.footer.links.length ? (
            <nav className="footer-links" aria-label="Footer">
              {site.footer.links.map((l) => (
                <a key={l.href + l.label} href={withBase(l.href)}>
                  {l.label}
                </a>
              ))}
            </nav>
          ) : null}
          {site.footer.poweredBy ? (
            <p className="footer-powered">
              Powered by <img src={withBase("/quill.svg")} alt="" width="16" height="16" /> <strong>Quill</strong>
            </p>
          ) : null}
        </footer>
      </div>
      <Enhance />
    </>
  );
}
