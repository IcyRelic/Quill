import type { Metadata } from "next";
import Link from "next/link";
import { search } from "@/lib/search";
import { withBase } from "@/lib/basePath";

export const metadata: Metadata = { title: "Search" };

/** Server-rendered results: what the search box falls back to without script, and a shareable results page. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim();
  const results = q ? await search(q, 30) : [];
  return (
    <div className="search-page">
      <h1>{q ? `Results for “${q}”` : "Search the docs"}</h1>
      <form action={withBase("/search")} role="search">
        <div className="search-field">
          <input name="q" type="search" defaultValue={q} aria-label="Search the docs" placeholder="What do you want to do?" />
          <button className="button" type="submit">
            Search
          </button>
        </div>
      </form>
      {q ? (
        results.length ? (
          <ul className="search-results">
            {results.map((r) => (
              <li key={r.slug}>
                <Link href={`/${r.slug}`}>
                  <span className="result-title">
                    {r.title}
                    {r.group ? <span className="result-group"> in {r.group}</span> : null}
                  </span>
                  <span className="result-excerpt">{r.excerpt}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ marginTop: 24 }}>
            Nothing matches. Try fewer or different words, or <Link className="text-link" href="/help/faq">browse common questions</Link>.
          </p>
        )
      ) : null}
    </div>
  );
}
