"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Row = { slug: string; title: string; description: string; draft: boolean; updated: string; updatedBy: string | null; group: string | null };

const SIZES = [25, 50, 100];

const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function PagesTable({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"all" | "draft" | "loose">("all");
  const [sort, setSort] = useState<"updated" | "title">("updated");
  const [size, setSize] = useState(SIZES[0]);
  const [page, setPage] = useState(0);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows
      .filter((r) => (show === "draft" ? r.draft : show === "loose" ? !r.group : true))
      .filter((r) => !t || r.title.toLowerCase().includes(t) || r.slug.includes(t))
      .sort((a, b) => (sort === "title" ? a.title.localeCompare(b.title) : b.updated.localeCompare(a.updated)));
  }, [rows, q, show, sort]);
  const pages = Math.max(1, Math.ceil(list.length / size));
  const shown = list.slice(page * size, page * size + size);

  // A new filter or page size starts again at the first page.
  useEffect(() => setPage(0), [q, show, sort, size]);

  return (
    <>
      <div className="a-toolbar">
        <input className="a-input" type="search" placeholder="Filter by title or address" aria-label="Filter pages" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="a-select" style={{ width: "auto", height: 34 }} aria-label="Show" value={show} onChange={(e) => setShow(e.target.value as typeof show)}>
          <option value="all">All pages</option>
          <option value="draft">Drafts</option>
          <option value="loose">Not in navigation</option>
        </select>
        <select className="a-select" style={{ width: "auto", height: 34 }} aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="updated">Recently updated</option>
          <option value="title">Title A to Z</option>
        </select>
      </div>
      <table className="a-table">
        <thead>
          <tr>
            <th>Title</th>
            <th className="a-hide-sm">Address</th>
            <th className="a-hide-sm">Group</th>
            <th>Status</th>
            <th className="a-hide-sm">Edited by</th>
            <th className="a-num">Updated</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.slug}>
              <td>
                <Link href={`/admin/pages/edit?slug=${encodeURIComponent(r.slug)}`}>{r.title}</Link>
              </td>
              <td className="a-path a-hide-sm">/{r.slug}</td>
              <td className="a-hide-sm">{r.group ?? <span className="a-path">—</span>}</td>
              <td>{r.draft ? <span className="a-status a-status-draft">Draft</span> : <span className="a-status a-status-live">Published</span>}</td>
              <td className="a-hide-sm">{r.updatedBy ?? <span className="a-path">—</span>}</td>
              <td className="a-num">{fmt.format(new Date(r.updated))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!list.length ? <p className="a-empty">No pages match.</p> : null}
      {list.length ? (
        <nav className="a-pager" aria-label="Pages of results">
          <span className="a-hint">
            {page * size + 1}–{Math.min(list.length, (page + 1) * size)} of {list.length}
          </span>
          <label className="a-pager-size">
            Per page
            <select className="a-select" value={size} onChange={(e) => setSize(Number(e.target.value))}>
              {SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div className="a-pager-pages">
            <button className="a-btn a-btn-small" type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            {Array.from({ length: pages }, (_, i) => i)
              // First, last, and the pages around the current one.
              .filter((i) => i === 0 || i === pages - 1 || Math.abs(i - page) <= 2)
              .map((i, k, arr) => (
                <span key={i} className="a-pager-item">
                  {k > 0 && i - arr[k - 1] > 1 ? <span className="a-hint">…</span> : null}
                  <button className="a-btn a-btn-small" type="button" aria-current={i === page ? "page" : undefined} onClick={() => setPage(i)}>
                    {i + 1}
                  </button>
                </span>
              ))}
            <button className="a-btn a-btn-small" type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        </nav>
      ) : null}
    </>
  );
}
