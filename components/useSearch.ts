"use client";

import { useEffect, useState } from "react";
import { withBase } from "@/lib/basePath";

export type Hit = { slug: string; title: string; group: string | null; excerpt: string };

/** Debounced search against /api/v1/search. */
export function useSearch(query: string) {
  const [results, setResults] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(withBase(`/api/v1/search?q=${encodeURIComponent(q)}`), { signal: ctrl.signal });
        const data = await res.json();
        setResults(data.results ?? []);
      } catch {
        /* aborted or offline: keep the last results */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);
  return { results, loading };
}
