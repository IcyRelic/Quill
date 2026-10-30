import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPage, getNeighbours } from "@/lib/content";
import { renderMarkdown } from "@/lib/markdown";
import { isAdmin } from "@/lib/auth";
import Toc from "@/components/Toc";

type Props = { params: Promise<{ slug: string[] }> };

async function load(parts: string[]) {
  const slug = parts.map(decodeURIComponent).join("/");
  const [page, admin] = await Promise.all([getPage(slug), isAdmin()]);
  if (!page || (page.draft && !admin)) return null;
  return { page, admin };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await load((await params).slug);
  return found ? { title: found.page.title, description: found.page.description } : { title: "Page not found" };
}

const dateFormat = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" });

export default async function DocPage({ params }: Props) {
  const found = await load((await params).slug);
  if (!found) notFound();
  const { page, admin } = found;
  const [{ prev, next }, { html, toc }] = await Promise.all([getNeighbours(page.slug), renderMarkdown(page.body)]);

  return (
    <div className="docs">
      <article className="doc">
        <header className="doc-header">
          <h1>{page.title}</h1>
          {page.description ? <p className="doc-lead">{page.description}</p> : null}
          {page.draft ? <p className="doc-draft">Draft. Only signed-in editors can see this page.</p> : null}
        </header>
        <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
        <footer className="doc-footer">
          <div className="doc-meta">
            <span>Updated {dateFormat.format(new Date(page.updated))}</span>
            {admin ? (
              <Link className="text-link" href={`/admin/pages/edit?slug=${encodeURIComponent(page.slug)}`}>
                Edit this page
              </Link>
            ) : null}
          </div>
          {prev || next ? (
            <nav className="pager" aria-label="Previous and next">
              {prev ? (
                <Link href={`/${prev.slug}`} rel="prev">
                  <span>Previous</span>
                  <strong>{prev.title}</strong>
                </Link>
              ) : null}
              {next ? (
                <Link className="pager-next" href={`/${next.slug}`} rel="next">
                  <span>Next</span>
                  <strong>{next.title}</strong>
                </Link>
              ) : null}
            </nav>
          ) : null}
        </footer>
      </article>
      <Toc items={toc} />
    </div>
  );
}
