/**
 * Navigation shapes and pure helpers, safe to import from client components.
 *
 * A sidebar group lists entries in order. An entry is a page slug, or a dropdown:
 * { "title": "Components", "pages": ["components/callouts", "components/steps"] }.
 */

export type NavFolder = { title: string; pages: string[] };
export type NavEntry = string | NavFolder;
export type NavGroup = { title: string; pages: NavEntry[] };

export const isFolder = (e: NavEntry): e is NavFolder => typeof e === "object" && e !== null;

/** Every slug in a group, dropdowns flattened in reading order. */
export const groupSlugs = (g: NavGroup) => g.pages.flatMap((e) => (isFolder(e) ? e.pages : [e]));

export const allSlugs = (nav: NavGroup[]) => nav.flatMap(groupSlugs);

/** Rewrites or removes (return null) every slug, keeping dropdowns in place. */
export function mapSlugs(nav: NavGroup[], fn: (slug: string) => string | null): NavGroup[] {
  const one = (s: string) => fn(s);
  return nav.map((g) => ({
    ...g,
    pages: g.pages.flatMap((e): NavEntry[] => {
      if (isFolder(e)) return [{ ...e, pages: e.pages.map(one).filter((s): s is string => !!s) }];
      const s = one(e);
      return s ? [s] : [];
    }),
  }));
}

export const withoutSlug = (nav: NavGroup[], slug: string) => mapSlugs(nav, (s) => (s === slug ? null : s));

export const groupOf = (nav: NavGroup[], slug: string) => nav.find((g) => groupSlugs(g).includes(slug))?.title ?? null;

/**
 * Checks and tidies navigation sent by the admin portal or the API.
 * Returns null when the shape is wrong. Duplicate slugs keep their first place.
 */
export function cleanNavigation(input: unknown): NavGroup[] | null {
  if (!Array.isArray(input)) return null;
  const seen = new Set<string>();
  const keep = (s: unknown): s is string => typeof s === "string" && !!s && !seen.has(s) && !!seen.add(s);
  const out: NavGroup[] = [];
  for (const g of input) {
    if (!g || typeof g.title !== "string" || !Array.isArray(g.pages)) return null;
    const pages: NavEntry[] = [];
    for (const e of g.pages) {
      if (typeof e === "string") {
        if (keep(e)) pages.push(e);
      } else if (e && typeof e.title === "string" && Array.isArray(e.pages)) {
        pages.push({ title: e.title.trim(), pages: e.pages.filter(keep) });
      } else return null;
    }
    out.push({ title: g.title.trim(), pages });
  }
  return out;
}
