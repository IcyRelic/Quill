/**
 * The sub-path Quill is served under, such as "/docs", or "" when it runs at the root of its domain. It is set
 * with QUILL_BASE_PATH when building, and next.config.ts passes it on here.
 *
 * next/link, the router and redirect() add it themselves. Plain tags, fetch(), route-handler redirects and
 * addresses stored in content (uploads, the logo, links in Markdown) go through withBase(). Stored addresses
 * stay relative to Quill's root, so content moves between sites unchanged.
 */
export const BASE = process.env.NEXT_PUBLIC_QUILL_BASE_PATH ?? "";

/** Puts the base path in front of a root-relative address. Full URLs, //host, #anchors and relative paths pass through. */
export function withBase(url: string): string {
  if (!BASE || !url.startsWith("/") || url.startsWith("//")) return url;
  // The home page is /docs, not /docs/: Next.js redirects the second to the first.
  return url === "/" ? BASE : BASE + url;
}

/** The address relative to Quill's root, for one that may or may not carry the base path. */
export function stripBase(url: string): string {
  if (!BASE || (url !== BASE && !url.startsWith(BASE + "/") && !url.startsWith(BASE + "?"))) return url;
  return url.slice(BASE.length) || "/";
}
