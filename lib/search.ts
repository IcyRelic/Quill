import { listPages, getNavigation } from "./content";
import { plainText } from "./markdown";

export type SearchHit = { slug: string; title: string; description: string; group: string | null; excerpt: string; score: number };

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/** Small in-process search over every published page. Plenty for a help centre of a few hundred pages. */
export async function search(query: string, limit = 12): Promise<SearchHit[]> {
  const terms = norm(query).split(/\s+/).filter((t) => t.length > 1 || /\d/.test(t));
  if (!terms.length) return [];
  const [pages, nav] = await Promise.all([listPages(), getNavigation()]);
  const groupOf = new Map(nav.flatMap((g) => g.items.map((i) => [i.slug, g.title] as const)));
  const hits: SearchHit[] = [];
  for (const p of pages) {
    const title = norm(p.title);
    const desc = norm(p.description);
    const headings = norm((p.body.match(/^#{2,3} .*$/gm) ?? []).join(" "));
    const raw = plainText(p.body);
    const body = norm(raw);
    let score = 0;
    let all = true;
    for (const t of terms) {
      const s = (title.includes(t) ? 12 : 0) + (desc.includes(t) ? 5 : 0) + (headings.includes(t) ? 4 : 0) + Math.min(body.split(t).length - 1, 5);
      if (!s) all = false;
      score += s;
    }
    if (!score) continue;
    if (all) score *= 2;
    if (title.startsWith(terms[0])) score += 6;
    const at = body.indexOf(terms[0]);
    const excerpt = at < 0 ? p.description || raw.slice(0, 140) : (at > 40 ? "…" : "") + raw.slice(Math.max(0, at - 40), at + 120).trim() + "…";
    hits.push({ slug: p.slug, title: p.title, description: p.description, group: groupOf.get(p.slug) ?? null, excerpt, score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
