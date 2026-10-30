"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Small progressive enhancements for rendered Markdown and the home page:
 * tabs, copy buttons on code, and section entrances. Everything works without it.
 */
export default function Enhance() {
  const pathname = usePathname();

  useEffect(() => {
    // Tabs
    const cleanups: (() => void)[] = [];
    document.querySelectorAll<HTMLElement>("[data-tabs]").forEach((root) => {
      const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
      const panels = [...root.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
      const select = (i: number, focus = false) => {
        tabs.forEach((t, j) => {
          t.setAttribute("aria-selected", String(i === j));
          t.tabIndex = i === j ? 0 : -1;
        });
        panels.forEach((p, j) => p.setAttribute("data-active", String(i === j)));
        if (focus) tabs[i].focus();
      };
      tabs.forEach((t, i) => {
        const click = () => select(i);
        const key = (e: KeyboardEvent) => {
          if (e.key === "ArrowRight") select((i + 1) % tabs.length, true);
          if (e.key === "ArrowLeft") select((i - 1 + tabs.length) % tabs.length, true);
        };
        t.addEventListener("click", click);
        t.addEventListener("keydown", key);
        cleanups.push(() => {
          t.removeEventListener("click", click);
          t.removeEventListener("keydown", key);
        });
      });
    });

    // Copy buttons
    document.querySelectorAll<HTMLPreElement>(".prose pre").forEach((pre) => {
      if (pre.querySelector(".copy-button")) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "copy-button";
      b.textContent = "Copy";
      b.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(pre.querySelector("code")?.innerText ?? pre.innerText);
          b.textContent = "Copied";
        } catch {
          b.textContent = "Select and copy";
        }
        setTimeout(() => (b.textContent = "Copy"), 1600);
      });
      pre.appendChild(b);
    });

    // Section entrances
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -12% 0px" },
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));

    return () => {
      cleanups.forEach((c) => c());
      io.disconnect();
    };
  }, [pathname]);

  return null;
}
