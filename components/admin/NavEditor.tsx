"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { allSlugs, isFolder, mapSlugs, withoutSlug, type NavEntry, type NavGroup } from "@/lib/nav";
import { adminFetch } from "./api";

type Pages = Record<string, { title: string; draft: boolean }>;
type Props = { initial: NavGroup[]; pages: Pages };

const move = <T,>(list: T[], from: number, to: number) => {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

/** Where a page can go: "g:<group>" for the group itself, "f:<group>:<entry>" for a dropdown in it. */
function Destinations({ groups }: { groups: NavGroup[] }) {
  return (
    <>
      {groups.map((g, gi) => (
        <optgroup key={gi} label={g.title || "Unnamed group"}>
          <option value={`g:${gi}`}>{g.title || "Unnamed group"}</option>
          {g.pages.map((e, ei) =>
            isFolder(e) ? (
              <option key={ei} value={`f:${gi}:${ei}`}>
                {g.title} › {e.title || "Unnamed dropdown"}
              </option>
            ) : null,
          )}
        </optgroup>
      ))}
    </>
  );
}

function PageRow({ slug, pages, where, groups, first, last, onMove, onSend }: { slug: string; pages: Pages; where: string; groups: NavGroup[]; first: boolean; last: boolean; onMove: (d: -1 | 1) => void; onSend: (to: string) => void }) {
  const title = pages[slug]?.title ?? slug;
  return (
    <li>
      <span>
        {title} <span className="a-path">/{slug}</span>
        {pages[slug]?.draft ? <span className="a-status a-status-draft"> Draft</span> : null}
      </span>
      <button className="a-btn a-btn-small a-icon-btn" type="button" aria-label={`Move ${title} up`} disabled={first} onClick={() => onMove(-1)}>
        ↑
      </button>
      <button className="a-btn a-btn-small a-icon-btn" type="button" aria-label={`Move ${title} down`} disabled={last} onClick={() => onMove(1)}>
        ↓
      </button>
      <select className="a-select" aria-label={`Place for ${title}`} value={where} onChange={(e) => onSend(e.target.value)}>
        <Destinations groups={groups} />
        <option value="">Take out of sidebar</option>
      </select>
    </li>
  );
}

export default function NavEditor({ initial, pages }: Props) {
  const router = useRouter();
  const [groups, setGroups] = useState<NavGroup[]>(() => mapSlugs(initial, (s) => (pages[s] ? s : null)));
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const update = (next: NavGroup[]) => {
    setGroups(next);
    setDirty(true);
    setStatus("");
  };
  const placed = new Set(allSlugs(groups));
  const loose = Object.keys(pages)
    .filter((s) => !placed.has(s))
    .sort();

  const setGroup = (gi: number, fn: (g: NavGroup) => NavGroup) => update(groups.map((g, i) => (i === gi ? fn(g) : g)));
  const setEntries = (gi: number, fn: (pages: NavEntry[]) => NavEntry[]) => setGroup(gi, (g) => ({ ...g, pages: fn(g.pages) }));

  const sendTo = (slug: string, to: string) => {
    const next = withoutSlug(groups, slug);
    const [kind, gs, es] = to.split(":");
    const gi = Number(gs);
    if (kind === "g" && next[gi]) next[gi] = { ...next[gi], pages: [...next[gi].pages, slug] };
    if (kind === "f" && next[gi]) {
      next[gi] = { ...next[gi], pages: next[gi].pages.map((e, i) => (i === Number(es) && isFolder(e) ? { ...e, pages: [...e.pages, slug] } : e)) };
    }
    update(next);
  };

  /** Removing a dropdown keeps its pages, in its place in the group. */
  const removeFolder = (gi: number, ei: number) => setEntries(gi, (list) => list.flatMap((e, i) => (i === ei && isFolder(e) ? e.pages : [e])));

  const save = async () => {
    setError("");
    if (groups.some((g) => !g.title.trim())) return setError("Every group needs a name.");
    if (groups.some((g) => g.pages.some((e) => isFolder(e) && !e.title.trim()))) return setError("Every dropdown needs a name.");
    try {
      await adminFetch("/api/v1/navigation", { method: "PUT", json: { navigation: groups } });
      setDirty(false);
      setStatus("Saved");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <div className="a-head">
        <div>
          <h1>Navigation</h1>
          <p className="a-sub">The sidebar readers see, in order. Dropdowns fold related pages under one name.</p>
        </div>
        <div className="a-head-actions">
          <span className="a-saved">{dirty ? "Unsaved changes" : status}</span>
          <button className="a-btn" type="button" onClick={() => update([...groups, { title: `New group ${groups.length + 1}`, pages: [] }])}>
            Add group
          </button>
          <button className="a-btn a-btn-primary" type="button" onClick={save} disabled={!dirty}>
            Save navigation
          </button>
        </div>
      </div>
      {error ? (
        <p className="a-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="a-groups">
        <div>
          {groups.map((g, gi) => (
            <section className="a-group" key={gi} aria-label={g.title || "Unnamed group"}>
              <div className="a-group-head">
                <input className="a-input" aria-label="Group name" value={g.title} onChange={(e) => setGroup(gi, (x) => ({ ...x, title: e.target.value }))} />
                <button className="a-btn a-btn-small a-icon-btn" type="button" aria-label={`Move ${g.title} up`} disabled={gi === 0} onClick={() => update(move(groups, gi, gi - 1))}>
                  ↑
                </button>
                <button className="a-btn a-btn-small a-icon-btn" type="button" aria-label={`Move ${g.title} down`} disabled={gi === groups.length - 1} onClick={() => update(move(groups, gi, gi + 1))}>
                  ↓
                </button>
                <button className="a-btn a-btn-small" type="button" onClick={() => setEntries(gi, (list) => [...list, { title: "New dropdown", pages: [] }])}>
                  Add dropdown
                </button>
                <button
                  className="a-btn a-btn-small"
                  type="button"
                  onClick={() => {
                    const n = allSlugs([g]).length;
                    if (!n || window.confirm(`Remove the group “${g.title}”? Its ${n} pages stay on the site but leave the sidebar.`)) update(groups.filter((_, i) => i !== gi));
                  }}
                >
                  Remove
                </button>
              </div>
              <ul className="a-rows">
                {g.pages.map((e, ei) => {
                  const first = ei === 0;
                  const last = ei === g.pages.length - 1;
                  if (!isFolder(e)) {
                    return <PageRow key={e} slug={e} pages={pages} where={`g:${gi}`} groups={groups} first={first} last={last} onMove={(d) => setEntries(gi, (list) => move(list, ei, ei + d))} onSend={(to) => sendTo(e, to)} />;
                  }
                  const setFolderPages = (fn: (p: string[]) => string[]) => setEntries(gi, (list) => list.map((x, i) => (i === ei && isFolder(x) ? { ...x, pages: fn(x.pages) } : x)));
                  return (
                    <li className="a-folder" key={`f-${ei}`}>
                      <div className="a-folder-head">
                        <input
                          className="a-input"
                          aria-label="Dropdown name"
                          value={e.title}
                          onChange={(ev) => setEntries(gi, (list) => list.map((x, i) => (i === ei && isFolder(x) ? { ...x, title: ev.target.value } : x)))}
                        />
                        <button className="a-btn a-btn-small a-icon-btn" type="button" aria-label={`Move ${e.title} up`} disabled={first} onClick={() => setEntries(gi, (list) => move(list, ei, ei - 1))}>
                          ↑
                        </button>
                        <button className="a-btn a-btn-small a-icon-btn" type="button" aria-label={`Move ${e.title} down`} disabled={last} onClick={() => setEntries(gi, (list) => move(list, ei, ei + 1))}>
                          ↓
                        </button>
                        <button className="a-btn a-btn-small" type="button" onClick={() => removeFolder(gi, ei)}>
                          Ungroup
                        </button>
                      </div>
                      <ul className="a-rows">
                        {e.pages.map((slug, pi) => (
                          <PageRow
                            key={slug}
                            slug={slug}
                            pages={pages}
                            where={`f:${gi}:${ei}`}
                            groups={groups}
                            first={pi === 0}
                            last={pi === e.pages.length - 1}
                            onMove={(d) => setFolderPages((p) => move(p, pi, pi + d))}
                            onSend={(to) => sendTo(slug, to)}
                          />
                        ))}
                        {!e.pages.length ? <li className="a-path">Empty. Send pages here from their menu.</li> : null}
                      </ul>
                    </li>
                  );
                })}
                {!g.pages.length ? <li className="a-path">No pages yet. Add one from the list on the right.</li> : null}
              </ul>
            </section>
          ))}
        </div>
        <aside className="a-panel">
          <h2 className="a-label">Not in the sidebar</h2>
          <p className="a-hint" style={{ marginTop: 4 }}>
            These pages are published but readers only reach them by search or links.
          </p>
          <ul className="a-rows">
            {loose.map((slug) => (
              <li key={slug}>
                <span>{pages[slug].title}</span>
                <select className="a-select" aria-label={`Add ${pages[slug].title} to the sidebar`} value="" onChange={(e) => sendTo(slug, e.target.value)}>
                  <option value="">Add to…</option>
                  <Destinations groups={groups} />
                </select>
              </li>
            ))}
            {!loose.length ? <li className="a-path">Every page is in the sidebar.</li> : null}
          </ul>
        </aside>
      </div>
    </>
  );
}
