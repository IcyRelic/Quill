"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { ResolvedGroup } from "@/lib/content";
import { withBase } from "@/lib/basePath";
import SearchDialog from "./SearchDialog";
import Sidebar from "./Sidebar";

type Props = {
  name: string;
  tagline: string;
  logo: string;
  links: { label: string; href: string }[];
  nav: ResolvedGroup[];
};

/** The link for the section the reader is in: the deepest match on the link's folder, else the one pointing home. */
export function activeLink(links: { href: string }[], pathname: string) {
  const folder = (href: string) => href.replace(/\/[^/]*$/, "");
  const scored = links
    .filter((l) => l.href.startsWith("/") && l.href !== "/")
    .map((l) => ({ l, f: folder(l.href) }))
    .filter(({ l, f }) => pathname === l.href || (f && (pathname === f || pathname.startsWith(f + "/"))))
    .sort((a, b) => b.f.length - a.f.length);
  return scored[0]?.l.href ?? links.find((l) => l.href === "/")?.href ?? null;
}

export default function TopBar({ name, tagline, logo, links, nav }: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shortcut, setShortcut] = useState("Ctrl K");
  const pathname = usePathname();
  const current = activeLink(links, pathname);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setShortcut("⌘ K");
  }, []);

  return (
    <>
      <header className="topbar">
        <button className="menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="mobile-nav" aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen((o) => !o)}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            {menuOpen ? <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /> : <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
          </svg>
        </button>
        <Link className="wordmark" href="/">
          <img src={withBase(logo)} alt="" width="28" height="28" />
          <span>{name}</span>
          {tagline ? <span className="wordmark-sub">{tagline}</span> : null}
        </Link>
        <nav className="topbar-links" aria-label="Sections">
          {links.map((l) => (
            <Link key={l.href + l.label} href={l.href} aria-current={l.href === current ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <button className="search-trigger" type="button" onClick={() => setSearchOpen(true)} aria-haspopup="dialog" aria-label="Search">
          <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span>Search...</span>
          <kbd>{shortcut}</kbd>
        </button>
      </header>
      {/* Below 900px the sidebar opens as a drawer, with the section links on top. */}
      {menuOpen ? (
        <>
          <div className="sidebar-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <Sidebar nav={nav} id="mobile-nav" open links={links} currentLink={current} />
        </>
      ) : null}
      {searchOpen ? <SearchDialog onClose={() => setSearchOpen(false)} /> : null}
    </>
  );
}
