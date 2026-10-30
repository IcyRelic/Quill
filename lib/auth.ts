import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { verifyKey, type Credential } from "./keys";
import { getSite } from "./content";

export const SESSION_COOKIE = "quill_session";
const SESSION_DAYS = 14;

const secret = () => process.env.QUILL_SESSION_SECRET || "";
export const adminConfigured = () => Boolean(process.env.QUILL_ADMIN_PASSWORD && secret().length >= 16);

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function checkPassword(password: string) {
  return adminConfigured() && safeEqual(password, process.env.QUILL_ADMIN_PASSWORD!);
}

export function createSessionToken() {
  const expires = Date.now() + SESSION_DAYS * 864e5;
  const payload = `admin.${expires}`;
  return { token: `${payload}.${sign(payload)}`, expires: new Date(expires) };
}

function verifySessionToken(token: string | undefined) {
  if (!token || !adminConfigured()) return false;
  const i = token.lastIndexOf(".");
  if (i < 0) return false;
  const payload = token.slice(0, i);
  if (!safeEqual(token.slice(i + 1), sign(payload))) return false;
  const expires = Number(payload.split(".")[1]);
  return Number.isFinite(expires) && expires > Date.now();
}

/** True when the visitor has a valid admin session (server components and route handlers). */
export async function isAdmin() {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/**
 * Who is calling: an API key (a portal key, a legacy key, or one a connected app issued), a connected app's own
 * token, or the signed-in admin. `name` is what page history shows ("updatedBy").
 */
export type Caller = Credential | { kind: "admin"; name: string } | null;

/** The name shown for the admin (Site settings), for page history and app approvals. */
export const adminName = async () => (await getSite()).adminName;

/**
 * Who is calling an API route. Bots send `Authorization: Bearer <key>` (or `x-api-key`).
 * The admin portal sends its session cookie plus `x-quill-admin: 1`, which a cross-site form cannot set.
 */
export async function getCaller(req: Request): Promise<Caller> {
  const header = req.headers.get("authorization");
  const key = header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : req.headers.get("x-api-key")?.trim();
  if (key) {
    const credential = await verifyKey(key);
    if (credential) return credential;
  }
  if (req.headers.get("x-quill-admin") === "1" && (await isAdmin())) return { kind: "admin", name: await adminName() };
  return null;
}
