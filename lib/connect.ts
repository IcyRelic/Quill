import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { ContentError } from "./content";
import { createApp } from "./keys";

/**
 * Pairing an app (InkBot, for example) without copying keys:
 * 1. The app calls start and shows the code; an admin opens verify_url and approves or denies it.
 * 2. The app polls with the code and its secret until it gets its token (once), a denial or an expiry.
 *
 * Pending requests live in memory (on globalThis, which every route shares) and last 15 minutes. A restart
 * forgets them, and the app simply starts again.
 */

export const EXPIRES_IN = 15 * 60;
export const INTERVAL = 3;
const MAX_PENDING = 100;
const STARTS_PER_MINUTE = 10;

type Pending = {
  code: string;
  secretHash: string;
  clientName: string;
  expiresAt: number;
  status: "pending" | "approved" | "denied";
  /** Held only until the app collects it. */
  token?: string;
  approvedBy?: string;
  collected?: boolean;
};

const shared = globalThis as unknown as { __quillConnect?: { pending: Map<string, Pending>; starts: Map<string, number[]> } };
const state = (shared.__quillConnect ??= { pending: new Map<string, Pending>(), starts: new Map<string, number[]>() });

const hash = (s: string) => createHash("sha256").update(s).digest();
// No I, O, 0 or 1: the code is read off one screen and compared with another.
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const pick = (chars: string, n: number) => Array.from({ length: n }, () => chars[randomInt(chars.length)]).join("");

function sweep() {
  const now = Date.now();
  for (const [code, p] of state.pending) if (p.expiresAt < now || p.collected) state.pending.delete(code);
}

export function normalizeCode(code: unknown) {
  return typeof code === "string" ? code.trim().toUpperCase() : "";
}

/** Starts a pairing request. `ip` is used only for the rate limit. */
export function startConnect(clientName: unknown, ip: string) {
  sweep();
  const now = Date.now();
  const recent = (state.starts.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= STARTS_PER_MINUTE || state.pending.size >= MAX_PENDING) {
    throw new ContentError("Too many connection requests. Wait a minute and try again.", 429);
  }
  state.starts.set(ip, [...recent, now]);
  const name = typeof clientName === "string" && clientName.trim() ? clientName.trim().slice(0, 80) : "An app";
  let code = "";
  do code = `${pick(LETTERS, 4)}-${pick(DIGITS, 4)}`;
  while (state.pending.has(code));
  const secret = randomBytes(32).toString("base64url");
  state.pending.set(code, { code, secretHash: hash(secret).toString("hex"), clientName: name, expiresAt: now + EXPIRES_IN * 1000, status: "pending" });
  return { code, secret };
}

/** A pending request, for the approval screen. Null when unknown or expired. */
export function getPending(code: string) {
  sweep();
  const p = state.pending.get(normalizeCode(code));
  return p ? { code: p.code, clientName: p.clientName, status: p.status, expiresAt: p.expiresAt, approvedBy: p.approvedBy ?? null } : null;
}

/** The admin's answer. Approving makes the connected app and its token. */
export async function decideConnect(code: string, approve: boolean, approvedBy: string) {
  sweep();
  const p = state.pending.get(normalizeCode(code));
  if (!p) throw new ContentError("That code has expired or doesn't exist. Ask the app to start connecting again.", 410);
  if (p.status !== "pending") throw new ContentError(`This request was already ${p.status}.`, 409);
  if (!approve) {
    p.status = "denied";
    return { status: p.status };
  }
  const { app, token } = await createApp(p.clientName, approvedBy);
  p.status = "approved";
  p.token = token;
  p.approvedBy = approvedBy;
  return { status: p.status, app };
}

type PollResult = { status: 202 | 200 | 403 | 410; body: Record<string, unknown> };

/** What the app sees when it polls. The token is handed over once; later polls get 410. */
export function pollConnect(code: unknown, secret: unknown, siteName: string): PollResult {
  sweep();
  const gone: PollResult = { status: 410, body: { error: "This connection request has expired or is unknown. Start again." } };
  const p = state.pending.get(normalizeCode(code));
  if (!p || typeof secret !== "string") return gone;
  const a = Buffer.from(p.secretHash, "hex");
  const b = hash(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return gone;
  if (p.status === "pending") return { status: 202, body: { status: "pending" } };
  if (p.status === "denied") return { status: 403, body: { error: "The request to connect was denied in the admin portal." } };
  const token = p.token;
  p.token = undefined;
  p.collected = true;
  if (!token) return gone;
  return { status: 200, body: { token, site: { name: siteName }, user: { name: p.approvedBy } } };
}
