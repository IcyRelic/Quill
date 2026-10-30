"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminNav({ pageCount, draftCount }: { pageCount: number; draftCount: number }) {
  const path = usePathname();
  const items = [
    { href: "/admin", label: "Pages", count: draftCount ? `${draftCount} draft${draftCount > 1 ? "s" : ""}` : String(pageCount), match: (p: string) => p === "/admin" || p.startsWith("/admin/pages") },
    { href: "/admin/navigation", label: "Navigation" },
    { href: "/admin/home", label: "Home page" },
    { href: "/admin/files", label: "Files" },
    { href: "/admin/appearance", label: "Appearance" },
    { href: "/admin/settings", label: "Site settings" },
    { href: "/admin/api", label: "API keys" },
  ];
  return (
    <aside className="a-side">
      <nav className="a-nav" aria-label="Admin">
        {items.map((i) => {
          const active = i.match ? i.match(path) : path.startsWith(i.href);
          return (
            <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}>
              {i.label}
              {i.count ? <span className="a-count">{i.count}</span> : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
