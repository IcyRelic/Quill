"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearch } from "./useSearch";
import { withBase } from "@/lib/basePath";

/**
 * The search field with results that update as you type. Arrow keys move through results,
 * Enter opens one. Without script the form submits to /search.
 */
export default function SearchBox({ autoFocus = false, onNavigate, placeholder = "Search the docs", showButton = false }: { autoFocus?: boolean; onNavigate?: () => void; placeholder?: string; showButton?: boolean }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(autoFocus);
  const { results, loading } = useSearch(query);
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const open = focused && query.trim().length > 0;

  const go = (slug: string) => {
    onNavigate?.();
    router.push(`/${slug}`);
  };

  return (
    <form
      className="home-search"
      action={withBase("/search")}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (results[active]) go(results[active].slug);
        else if (query.trim()) {
          onNavigate?.();
          router.push(`/search?q=${encodeURIComponent(query.trim())}`);
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
      }}
    >
      <div className="search-field">
        <svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <input
          ref={inputRef}
          name="q"
          type="search"
          value={query}
          autoFocus={autoFocus}
          autoComplete="off"
          placeholder={placeholder}
          aria-label="Search the docs"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
          onFocus={() => setFocused(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            }
          }}
        />
        {showButton ? (
          <button className="button" type="submit">
            Search
          </button>
        ) : null}
      </div>
      {open ? (
        <ul className="search-results" id={listId} role="listbox" aria-label="Results">
          {results.length ? (
            results.map((r, i) => (
              <li key={r.slug} role="presentation">
                <a
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  href={withBase(`/${r.slug}`)}
                  onMouseEnter={() => setActive(i)}
                  onClick={(e) => {
                    e.preventDefault();
                    go(r.slug);
                  }}
                >
                  <span className="result-title">
                    {r.title}
                    {r.group ? <span className="result-group"> in {r.group}</span> : null}
                  </span>
                  <span className="result-excerpt">{r.excerpt}</span>
                </a>
              </li>
            ))
          ) : (
            <li className="search-empty" role="presentation">
              {loading ? "Searching…" : `Nothing matches “${query.trim()}”. Try fewer or different words.`}
            </li>
          )}
        </ul>
      ) : null}
    </form>
  );
}
