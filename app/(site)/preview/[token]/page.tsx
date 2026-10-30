import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPageByPreviewToken } from "@/lib/content";
import { renderMarkdown } from "@/lib/markdown";
import Toc from "@/components/Toc";

type Props = { params: Promise<{ token: string }> };

/**
 * A draft's shareable preview link: anyone with the link can read the page as the site will show it, without
 * signing in. Once the page is published, the link goes to the real page.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getPageByPreviewToken((await params).token);
  return { title: page ? `Preview: ${page.title}` : "Page not found", robots: { index: false, follow: false } };
}

export default async function PreviewPage({ params }: Props) {
  const page = await getPageByPreviewToken((await params).token);
  if (!page) notFound();
  if (!page.draft) redirect(`/${page.slug}`);
  const { html, toc } = await renderMarkdown(page.body);

  return (
    <div className="docs">
      <article className="doc">
        <p className="preview-banner" role="note">
          <strong>Draft preview</strong> This page isn’t published yet. Anyone with this link can read it.
        </p>
        <header className="doc-header">
          <h1>{page.title}</h1>
          {page.description ? <p className="doc-lead">{page.description}</p> : null}
        </header>
        <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
      </article>
      <Toc items={toc} />
    </div>
  );
}
