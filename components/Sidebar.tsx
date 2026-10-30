"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { NavFolderItem, NavItem, ResolvedGroup } from "@/lib/content";

const isFolder = (e: NavItem | NavFolderItem): e is NavFolderItem => "items" in e;

function PageLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const href = `/${item.slug}`;
  return (
    <Link href={href} aria-current={pathname === href ? "page" : undefined}>
      {item.title}
      {item.draft ? <span className="sidebar-draft"> (draft)</span> : null}
    </Link>
  );
}

/** A dropdown: opens by itself when the reader is on one of its pages, and stays as the reader leaves it. */
function Folder({ folder, pathname, id }: { folder: NavFolderItem; pathname: string; id: string }) {
  const inside = folder.items.some((i) => pathname === `/${i.slug}`);
  const [open, setOpen] = useState(inside);
  useEffect(() => {
    if (inside) setOpen(true);
  }, [inside]);
  return (
    <li className={`sidebar-folder${inside ? " has-current" : ""}`}>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {folder.title}
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M4.5 2.5L8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <ul id={id} hidden={!open}>
        {folder.items.map((i) => (
          <li key={i.slug}>
            <PageLink item={i} pathname={pathname} />
          </li>
        ))}
      </ul>
    </li>
  );
}

type Props = {
  nav: ResolvedGroup[];
  id?: string;
  open?: boolean;
  /** On phones the drawer also carries the top bar's section links. */
  links?: { label: string; href: string }[];
  currentLink?: string | null;
};

export default function Sidebar({ nav, id, open = false, links, currentLink }: Props) {
  const pathname = usePathname();
  const prefix = id ?? "side";
  return (
    <nav id={id} className={`sidebar${open ? " is-open" : " sidebar-desktop"}`} aria-label="Documentation">
      {links?.length ? (
        <ul className="sidebar-links">
          {links.map((l) => (
            <li key={l.href + l.label}>
              <Link href={l.href} aria-current={l.href === currentLink ? "page" : undefined}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {nav.map((g, gi) => (
        <div className="sidebar-group" key={g.title}>
          <h2>{g.title}</h2>
          <ul>
            {g.entries.map((e, ei) =>
              isFolder(e) ? (
                <Folder key={`f-${e.title}`} folder={e} pathname={pathname} id={`${prefix}-${gi}-${ei}`} />
              ) : (
                <li key={e.slug}>
                  <PageLink item={e} pathname={pathname} />
                </li>
              ),
            )}
          </ul>
        </div>
      ))}
    </nav>
  );
}
