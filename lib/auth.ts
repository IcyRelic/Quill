import { createHmac, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyKey, type Credential } from "./keys";
import { sessionUser, type Role, type UserInfo } from "./users";

export const SESSION_COOKIE = "quill_session";
const SESSION_DAYS = 14;

const secret = () => process.env.QUILL_SESSION_SECRET || "";
/** Signing in needs QUILL_SESSION_SECRET (16+ characters) to sign sessions with. */
export const sessionsConfigured = () => secret().length >= 16;

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

/** A signed session for an account. Its session version makes a password change sign out older sessions. */
export function createSessionToken(user: { id: string; sessionVersion: number }) {
  const expires = Date.now() + SESSION_DAYS * 864e5;
  const payload = `u.${user.id}.${user.sessionVersion}.${expires}`;
  return { token: `${payload}.${sign(payload)}`, expires: new Date(expires) };
}

async function verifySessionToken(token: string | undefined): Promise<UserInfo | null> {
  if (!token || !sessionsConfigured()) return null;
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const payload = token.slice(0, i);
  if (!safeEqual(token.slice(i + 1), sign(payload))) return null;
  const [kind, id, version, expires] = payload.split(".");
  if (kind !== "u" || !(Number(expires) > Date.now())) return null;
  return sessionUser(id, Number(version));
}

/** The signed-in account, or null (server components and route handlers). */
export const getSessionUser = cache(async () => verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value));

/** For screens only admins may open: editors go back to the pages list. */
export async function requireAdminScreen() {
  const user = await getSessionUser();
  if (user?.role !== "admin") redirect("/admin");
  return user;
}

/**
 * Who is calling: an API key (a portal key, a legacy key, or one a connected app issued), a connected app's own
 * token, or a signed-in account. `name` is what page history shows ("updatedBy").
 */
export type Caller = Credential | { kind: "user"; id: string; name: string; role: Role } | null;

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
  if (req.headers.get("x-quill-admin") === "1") {
    const user = await getSessionUser();
    if (user) return { kind: "user", id: user.id, name: user.name, role: user.role };
  }
  return null;
}
