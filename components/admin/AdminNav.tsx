"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The portal sections. Editors don't see the ones only admins can use. */
export default function AdminNav({ pageCount, draftCount, admin }: { pageCount: number; draftCount: number; admin: boolean }) {
  const path = usePathname();
  const items = [
    { href: "/admin", label: "Pages", count: draftCount ? `${draftCount} draft${draftCount > 1 ? "s" : ""}` : String(pageCount), match: (p: string) => p === "/admin" || p.startsWith("/admin/pages") },
    { href: "/admin/navigation", label: "Navigation" },
    { href: "/admin/home", label: "Home page" },
    { href: "/admin/files", label: "Files" },
    { href: "/admin/appearance", label: "Appearance", admin: true },
    { href: "/admin/settings", label: "Site settings", admin: true },
    { href: "/admin/api", label: "API keys", admin: true },
    { href: "/admin/users", label: "Accounts", admin: true },
    { href: "/admin/account", label: "Your account" },
  ].filter((i) => admin || !i.admin);
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
