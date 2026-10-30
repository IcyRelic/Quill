"use client";

import { useEffect, useState } from "react";
import type { TocItem } from "@/lib/markdown";

/** "On this page", with the section you're reading marked. */
export default function Toc({ items }: { items: TocItem[] }) {
  const [current, setCurrent] = useState(items[0]?.id);
  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => !!e);
    const onScroll = () => {
      let id = els[0]?.id;
      for (const el of els) if (el.getBoundingClientRect().top < 140) id = el.id;
      setCurrent(id);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [items]);

  if (items.length < 2) return <aside className="toc" aria-hidden="true" />;
  return (
    <aside className="toc">
      <nav aria-label="On this page">
        <h2>On this page</h2>
        <ul>
          {items.map((i) => (
            <li key={i.id}>
              <a href={`#${i.id}`} className={`depth-${i.depth}`} aria-current={current === i.id ? "true" : undefined}>
                {i.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
