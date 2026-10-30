import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { groupSlugs, isFolder, mapSlugs, withoutSlug, type NavEntry, type NavFolder, type NavGroup } from "./nav";
import { cleanTheme, DEFAULT_FAVICON, DEFAULT_LOGO, type Theme } from "./theme";

export type { NavGroup, NavEntry, NavFolder } from "./nav";

export const CONTENT_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.QUILL_CONTENT_DIR || path.join(process.cwd(), "content"));
const PAGES_DIR = path.join(CONTENT_DIR, "pages");
const SITE_FILE = path.join(CONTENT_DIR, "site.json");
export const UPLOADS_DIR = path.join(CONTENT_DIR, "uploads");

/** A card on the home page. `icon` names one of the built-in drawings; `image` replaces it with an upload. */
export type HomeCard = { title: string; description: string; href: string; icon: string; image?: string };

export type SiteLink = { label: string; href: string };

export type SiteConfig = {
  name: string;
  tagline: string;
  description: string;
  /** Links in the top bar, beside the logo. */
  links: SiteLink[];
  navigation: NavGroup[];
  home: {
    title: string;
    lead: string;
    cards: HomeCard[];
    /** The faint drawing behind the heading. */
    showArt: boolean;
    /** Cards per row on wide screens, 1 to 4. */
    columns: number;
  };
  /** The footer line. {year} becomes the current year. */
  copyright: string;
  footer: {
    /** Links on the footer line. */
    links: SiteLink[];
    /** The "Powered by Quill" credit. */
    poweredBy: boolean;
  };
  /** Image beside the name in the top bar, the admin portal and the sign-in screen. */
  logo: string;
  /** Browser tab icon. */
  favicon: string;
  /** Colours changed from the defaults (lib/theme.ts). */
  theme: Theme;
  /** Shown as who approved connected apps and who edited pages in the portal. */
  adminName: string;
  /** The site's public address, for links Quill hands out (preview links, page URLs). Empty: the request's address. */
  publicUrl: string;
};


/** Fills in settings that older site.json files don't have, so every reader sees the full shape. */
function withDefaults(raw: Partial<SiteConfig>): SiteConfig {
  const home: Partial<SiteConfig["home"]> = raw.home ?? {};
  const footer: Partial<SiteConfig["footer"]> = raw.footer ?? {};
  const theme = cleanTheme(raw.theme);
  return {
    ...raw,
    name: raw.name ?? "Docs",
    tagline: raw.tagline ?? "",
    description: raw.description ?? "",
    links: Array.isArray(raw.links) ? raw.links : [],
    navigation: Array.isArray(raw.navigation) ? raw.navigation : [],
    home: { ...home, title: home.title ?? "", lead: home.lead ?? "", cards: Array.isArray(home.cards) ? home.cards : [], showArt: home.showArt ?? true, columns: home.columns ?? 2 },
    copyright: raw.copyright ?? "",
    footer: { ...footer, links: Array.isArray(footer.links) ? footer.links : [], poweredBy: footer.poweredBy ?? true },
    logo: raw.logo || DEFAULT_LOGO,
    favicon: raw.favicon || DEFAULT_FAVICON,
    theme: typeof theme === "string" ? { colors: {} } : theme,
    adminName: raw.adminName?.trim() || "Admin",
    publicUrl: raw.publicUrl ?? "",
  };
}

const isLinkList = (v: unknown) => Array.isArray(v) && v.every((l) => l && typeof l.label === "string" && typeof l.href === "string");

/**
 * Checks settings before they are saved, as sent (before defaults fill gaps, so a wrong shape is an error,
 * not quietly replaced). Settings that are left out are fine. Throws a ContentError that names the field.
 */
function checkSite(site: Partial<SiteConfig>) {
  const bad = (msg: string) => {
    throw new ContentError(msg);
  };
  if (typeof site.name !== "string" || !site.name.trim()) bad("name can't be empty.");
  for (const k of ["tagline", "description", "copyright", "logo", "favicon", "adminName", "publicUrl"] as const) {
    if (site[k] !== undefined && typeof site[k] !== "string") bad(`${k} must be a string.`);
  }
  if (site.publicUrl && !/^https?:\/\/[^/\s]+(\/\S*)?$/.test(site.publicUrl)) bad("publicUrl must be an address such as https://docs.example.org, or empty.");
  if (site.links !== undefined && !isLinkList(site.links)) bad('links must be a list of { "label": "...", "href": "/..." }.');
  const home = site.home as Partial<SiteConfig["home"]> | undefined;
  if (home !== undefined) {
    if (!home || typeof home !== "object") bad("home must be an object with title, lead and cards.");
    else {
      if (home.cards !== undefined && (!Array.isArray(home.cards) || !home.cards.every((c) => c && typeof c.title === "string" && typeof c.href === "string"))) {
        bad('home.cards must be a list of { "title": "...", "description": "...", "href": "/...", "icon": "quill" }.');
      }
      if (home.showArt !== undefined && typeof home.showArt !== "boolean") bad("home.showArt must be true or false.");
      if (home.columns !== undefined && ![1, 2, 3, 4].includes(home.columns)) bad("home.columns must be 1, 2, 3 or 4.");
    }
  }
  const footer = site.footer as Partial<SiteConfig["footer"]> | undefined;
  if (footer !== undefined) {
    if (!footer || typeof footer !== "object") bad('footer must be { "links": [{ "label": "...", "href": "..." }], "poweredBy": true }.');
    else {
      if (footer.links !== undefined && !isLinkList(footer.links)) bad('footer.links must be a list of { "label": "...", "href": "..." }.');
      if (footer.poweredBy !== undefined && typeof footer.poweredBy !== "boolean") bad("footer.poweredBy must be true or false.");
    }
  }
}

export type PageMeta = {
  slug: string;
  title: string;
  description: string;
  draft: boolean;
  updated: string;
  /** Who last saved the page: a key's or app's name, or the admin's name. Null when unknown. */
  updatedBy: string | null;
  /** The secret part of the page's shareable preview link. Not shown in the API; see pageForApi in lib/api.ts. */
  previewToken: string | null;
};

export type Page = PageMeta & { body: string };

const PREVIEW_TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
const newPreviewToken = () => randomBytes(18).toString("base64url");

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;
const RESERVED = new Set(["admin", "api", "search", "uploads", "images", "preview", "_next", "llms.txt", "favicon.ico"]);

export class ContentError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export function assertSlug(slug: string) {
  if (!SLUG_RE.test(slug)) {
    throw new ContentError("Slugs use lowercase letters, numbers and hyphens, with / between folders (for example guides/export-a-pdf).");
  }
  if (RESERVED.has(slug.split("/")[0])) throw new ContentError(`"${slug.split("/")[0]}" is reserved and cannot start a slug.`);
}

const fileFor = (slug: string) => path.join(PAGES_DIR, ...slug.split("/")) + ".md";

async function writeAtomic(file: string, data: string) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, data, "utf8");
  await fs.rename(tmp, file);
}

// ---------- site ----------

export async function getSite(): Promise<SiteConfig> {
  return withDefaults(JSON.parse(await fs.readFile(SITE_FILE, "utf8")) as Partial<SiteConfig>);
}

export async function saveSite(input: SiteConfig) {
  // Checked before withDefaults, which would quietly drop a bad theme.
  const theme = cleanTheme(input.theme);
  if (typeof theme === "string") throw new ContentError(theme);
  checkSite(input);
  const next = withDefaults({ ...input, theme });
  await writeAtomic(SITE_FILE, JSON.stringify(next, null, 2) + "\n");
  return next;
}

/** Shallow-merges top level keys, and one level deeper for plain objects (home, footer, theme). */
export async function patchSite(patch: Partial<SiteConfig>) {
  const site = await getSite();
  const merged: Record<string, unknown> = { ...site };
  for (const [k, v] of Object.entries(patch)) {
    const cur = (site as Record<string, unknown>)[k];
    merged[k] = v && typeof v === "object" && !Array.isArray(v) && cur && typeof cur === "object" && !Array.isArray(cur) ? { ...cur, ...v } : v;
  }
  return saveSite(merged as SiteConfig);
}

// ---------- pages ----------

async function walk(dir: string, prefix = ""): Promise<string[]> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    if (e.isDirectory()) out.push(...(await walk(path.join(dir, e.name), prefix + e.name + "/")));
    else if (e.name.endsWith(".md")) out.push(prefix + e.name.slice(0, -3));
  }
  return out;
}

function parse(slug: string, raw: string, mtime: Date): Page {
  const { data, content } = matter(raw);
  return {
    slug,
    title: String(data.title ?? slug.split("/").pop()),
    description: String(data.description ?? ""),
    draft: Boolean(data.draft),
    updated: data.updated ? new Date(data.updated).toISOString() : mtime.toISOString(),
    updatedBy: typeof data.updatedBy === "string" && data.updatedBy ? data.updatedBy : null,
    previewToken: typeof data.previewToken === "string" && PREVIEW_TOKEN_RE.test(data.previewToken) ? data.previewToken : null,
    body: content.replace(/^\n+/, ""),
  };
}

export async function getPage(slug: string): Promise<Page | null> {
  if (!SLUG_RE.test(slug)) return null;
  try {
    const file = fileFor(slug);
    const [raw, stat] = await Promise.all([fs.readFile(file, "utf8"), fs.stat(file)]);
    return parse(slug, raw, stat.mtime);
  } catch {
    return null;
  }
}

export async function listPages(opts: { includeDrafts?: boolean } = {}): Promise<Page[]> {
  const slugs = await walk(PAGES_DIR);
  const pages = (await Promise.all(slugs.map(getPage))).filter((p): p is Page => !!p);
  return pages.filter((p) => opts.includeDrafts || !p.draft).sort((a, b) => a.slug.localeCompare(b.slug));
}

export type PageInput = {
  title: string;
  description?: string;
  body?: string;
  draft?: boolean;
  /** Who is saving. Left out: whoever saved it last stays. */
  updatedBy?: string | null;
  /** Keeps a preview token (when a page moves). Otherwise the page's own token stays, or a new one is made. */
  previewToken?: string | null;
  /** Makes a new preview token, so the old preview link stops working. */
  resetPreview?: boolean;
};

export async function savePage(slug: string, input: PageInput): Promise<Page> {
  assertSlug(slug);
  if (!input.title || !input.title.trim()) throw new ContentError("A page needs a title.");
  const existing = await getPage(slug);
  const updated = new Date().toISOString();
  const front: Record<string, unknown> = { title: input.title.trim(), description: (input.description ?? "").trim(), updated };
  if (input.draft) front.draft = true;
  const by = input.updatedBy !== undefined ? input.updatedBy : (existing?.updatedBy ?? null);
  if (by) front.updatedBy = by;
  front.previewToken = input.resetPreview ? newPreviewToken() : (input.previewToken ?? existing?.previewToken ?? newPreviewToken());
  await writeAtomic(fileFor(slug), matter.stringify("\n" + (input.body ?? "").trim() + "\n", front));
  return (await getPage(slug))!;
}

/**
 * The page with a preview token, giving it one (without changing when or by whom it was updated) if it was
 * saved before pages had them.
 */
export async function withPreviewToken(page: Page): Promise<Page> {
  if (page.previewToken) return page;
  const raw = await fs.readFile(fileFor(page.slug), "utf8");
  const { data, content } = matter(raw);
  const previewToken = newPreviewToken();
  await writeAtomic(fileFor(page.slug), matter.stringify(content, { ...data, previewToken }));
  return { ...page, previewToken };
}

/** Gives a page a new preview token, so its old preview link stops working. Not counted as an edit. */
export async function resetPreviewToken(slug: string): Promise<Page> {
  const page = await getPage(slug);
  if (!page) throw new ContentError(`No page at "${slug}".`, 404);
  const { data, content } = matter(await fs.readFile(fileFor(slug), "utf8"));
  const previewToken = newPreviewToken();
  await writeAtomic(fileFor(slug), matter.stringify(content, { ...data, previewToken }));
  return { ...page, previewToken };
}

/** The page a preview link points at, drafts included. */
export async function getPageByPreviewToken(token: string): Promise<Page | null> {
  if (!PREVIEW_TOKEN_RE.test(token)) return null;
  return (await listPages({ includeDrafts: true })).find((p) => p.previewToken === token) ?? null;
}

export async function deletePage(slug: string) {
  assertSlug(slug);
  try {
    await fs.unlink(fileFor(slug));
  } catch {
    throw new ContentError(`No page at "${slug}".`, 404);
  }
  const site = await getSite();
  site.navigation = withoutSlug(site.navigation, slug);
  await saveSite(site);
}

export async function renamePage(from: string, to: string, updatedBy?: string | null) {
  assertSlug(to);
  const page = await getPage(from);
  if (!page) throw new ContentError(`No page at "${from}".`, 404);
  if (await getPage(to)) throw new ContentError(`A page already exists at "${to}".`, 409);
  // The preview link follows the page to its new address.
  await savePage(to, { ...page, updatedBy: updatedBy === undefined ? page.updatedBy : updatedBy, previewToken: page.previewToken });
  await fs.unlink(fileFor(from));
  const site = await getSite();
  site.navigation = mapSlugs(site.navigation, (s) => (s === from ? to : s));
  await saveSite(site);
}

/**
 * Puts a page in a navigation group (created if missing), removing it from anywhere else.
 * With `folder`, the page goes into that dropdown inside the group (created if missing).
 */
export async function placeInNav(slug: string, groupTitle: string, position?: number, folder?: string) {
  const site = await getSite();
  site.navigation = withoutSlug(site.navigation, slug);
  let group = site.navigation.find((g) => g.title === groupTitle);
  if (!group) {
    group = { title: groupTitle, pages: [] };
    site.navigation.push(group);
  }
  let list: NavEntry[] = group.pages;
  if (folder) {
    let f = group.pages.find((e): e is NavFolder => isFolder(e) && e.title === folder);
    if (!f) {
      f = { title: folder, pages: [] };
      group.pages.push(f);
    }
    list = f.pages;
  }
  const at = position === undefined ? list.length : Math.max(0, Math.min(position, list.length));
  list.splice(at, 0, slug);
  await saveSite(site);
}

// ---------- navigation helpers ----------

export type NavItem = { slug: string; title: string; draft: boolean };
export type NavFolderItem = { title: string; items: NavItem[] };
/** `items` is every page in reading order; `entries` keeps the dropdowns for the sidebar. */
export type ResolvedGroup = { title: string; items: NavItem[]; entries: (NavItem | NavFolderItem)[] };

export const isFolderItem = (e: NavItem | NavFolderItem): e is NavFolderItem => "items" in e;

export async function getNavigation(opts: { includeDrafts?: boolean } = {}): Promise<ResolvedGroup[]> {
  const [site, pages] = await Promise.all([getSite(), listPages({ includeDrafts: true })]);
  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  const resolve = (slugs: string[]) =>
    slugs
      .map((s) => bySlug.get(s))
      .filter((p): p is Page => !!p && (opts.includeDrafts || !p.draft))
      .map((p) => ({ slug: p.slug, title: p.title, draft: p.draft }));
  return site.navigation
    .map((g) => {
      const entries = g.pages
        .map((e) => (isFolder(e) ? { title: e.title, items: resolve(e.pages) } : resolve([e])[0]))
        .filter((e): e is NavItem | NavFolderItem => !!e && (!isFolderItem(e) || e.items.length > 0));
      return { title: g.title, items: resolve(groupSlugs(g)), entries };
    })
    .filter((g) => g.items.length > 0 || opts.includeDrafts);
}

export async function getNeighbours(slug: string) {
  const flat = (await getNavigation()).flatMap((g) => g.items.map((i) => ({ ...i, group: g.title })));
  const i = flat.findIndex((p) => p.slug === slug);
  return {
    group: i >= 0 ? flat[i].group : null,
    prev: i > 0 ? flat[i - 1] : null,
    next: i >= 0 && i < flat.length - 1 ? flat[i + 1] : null,
  };
}

// ---------- uploads ----------

const UPLOAD_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
};

export const MAX_UPLOAD = 15 * 1024 * 1024;

export function uploadType(name: string) {
  return UPLOAD_TYPES[path.extname(name).toLowerCase()] ?? null;
}

export async function saveUpload(name: string, data: Buffer) {
  const ext = path.extname(name).toLowerCase();
  if (!UPLOAD_TYPES[ext]) throw new ContentError(`Files of type ${ext || "(none)"} can't be uploaded. Allowed: ${Object.keys(UPLOAD_TYPES).join(", ")}.`);
  if (data.length > MAX_UPLOAD) throw new ContentError("Files can be up to 15 MB.");
  const base = path.basename(name, path.extname(name)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "file";
  let file = base + ext;
  for (let n = 2; await exists(path.join(UPLOADS_DIR, file)); n++) file = `${base}-${n}${ext}`;
  await writeAtomicBuffer(path.join(UPLOADS_DIR, file), data);
  return { name: file, url: `/uploads/${file}`, size: data.length };
}

export async function listUploads() {
  try {
    const names = await fs.readdir(UPLOADS_DIR);
    const out = [];
    for (const name of names) {
      if (!uploadType(name)) continue;
      const st = await fs.stat(path.join(UPLOADS_DIR, name));
      out.push({ name, url: `/uploads/${name}`, size: st.size, updated: st.mtime.toISOString() });
    }
    return out.sort((a, b) => b.updated.localeCompare(a.updated));
  } catch {
    return [];
  }
}

export async function deleteUpload(name: string) {
  if (name !== path.basename(name) || !uploadType(name)) throw new ContentError("Unknown file.", 404);
  try {
    await fs.unlink(path.join(UPLOADS_DIR, name));
  } catch {
    throw new ContentError("Unknown file.", 404);
  }
}

async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function writeAtomicBuffer(file: string, data: Buffer) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, file);
}
