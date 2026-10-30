import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ContentError, getSite, withPreviewToken, type Page } from "./content";
import { getCaller, type Caller } from "./auth";
import { BASE, withBase } from "./basePath";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
export const fail = (message: string, status = 400) => json({ error: message }, status);

/** Wraps a route handler: maps ContentError and bad JSON to clean error responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ContentError) return fail(e.message, e.status);
      if (e instanceof SyntaxError) return fail("The request body is not valid JSON.");
      console.error(e);
      return fail("Something went wrong on the server.", 500);
    }
  };
}

export async function requireWriter(req: Request) {
  const caller = await getCaller(req);
  if (!caller) throw new ContentError("Send an API key as 'Authorization: Bearer <key>', or sign in to the admin portal.", 401);
  return caller;
}

/** A signed-in account, never an API key. */
export async function requireUser(req: Request) {
  const caller = await getCaller(req);
  if (!caller) throw new ContentError("Sign in to the admin portal to do this.", 401);
  if (caller.kind !== "user") throw new ContentError("Only a signed-in account can do this, not an API key.", 403);
  return caller;
}

/** Only a signed-in admin, never an API key: managing keys with a key would let a leaked key make more. */
export async function requireAdmin(req: Request) {
  const caller = await requireUser(req);
  if (caller.role !== "admin") throw new ContentError("Only an admin can do this. Editors can change pages, navigation, the home page and files.", 403);
  return caller;
}

/** Only a connected app's own token (not a key it issued, a portal key or an admin session). */
export async function requireApp(req: Request) {
  const caller = await getCaller(req);
  if (!caller) throw new ContentError("Send the connected app's token as 'Authorization: Bearer <token>'.", 401);
  if (caller.kind !== "app") throw new ContentError("Only a connected app's own token can do this, not an API key or the admin portal.", 403);
  return caller;
}

/**
 * A 303 to a path in Quill. The Location is relative, so it stays right behind a proxy: req.url can carry the
 * server's bind address (0.0.0.0 in Docker) instead of the address the browser used.
 */
/** Whether the browser is on HTTPS, as the proxy in front reports it. Session cookies are then marked Secure. */
export const isHttps = (req: Request) => (req.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? new URL(req.url).protocol.replace(":", "")) === "https";

export const seeOther = (path: string) => new NextResponse(null, { status: 303, headers: { location: withBase(path) } });

/**
 * The address pages are shared at: the public URL from Site settings if one is set, else the request's own
 * origin (honouring a proxy's forwarded host and protocol) plus the base path.
 */
export async function publicOrigin(req: Request) {
  const set = (await getSite()).publicUrl.replace(/\/+$/, "");
  if (set) return set;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0] ?? new URL(req.url).protocol.replace(":", "");
  return (host ? `${proto}://${host}` : new URL(req.url).origin) + BASE;
}

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  const data = await req.json();
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new ContentError("Send a JSON object.");
  return data as T;
}

export function refreshSite() {
  revalidatePath("/", "layout");
}

export const slugFrom = (parts: string[]) => parts.map(decodeURIComponent).join("/");

/**
 * A page as the API returns it: `url` always; `previewUrl` (the shareable draft link) for drafts when the caller
 * has a key or an admin session. The preview token itself stays out of the response.
 */
export async function pageForApi<P extends Omit<Page, "body"> & { body?: string }>(req: Request, caller: Caller, page: P) {
  const origin = await publicOrigin(req);
  let token = page.previewToken;
  if (page.draft && caller && !token) token = (await withPreviewToken(page as unknown as Page)).previewToken;
  const { previewToken: _hidden, ...rest } = page;
  return { ...rest, url: `${origin}/${page.slug}`, ...(page.draft && caller && token ? { previewUrl: `${origin}/preview/${token}` } : {}) };
}
