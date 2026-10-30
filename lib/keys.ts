import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { CONTENT_DIR, ContentError } from "./content";

/**
 * API keys and connected apps. Only a SHA-256 hash of each key or app token is stored (they are 32 random
 * bytes, so a plain hash is enough); the secret itself is shown once, when it is made.
 *
 * - Portal keys are made in the admin portal.
 * - Connected apps (InkBot, for example) pair through /api/connect and an admin's approval. An app's token can
 *   do everything a key can, and can also issue keys of its own; disconnecting the app revokes them all.
 * - Keys in the QUILL_API_KEYS environment variable keep working as "legacy" keys, listed read-only.
 */

const KEYS_FILE = path.join(CONTENT_DIR, "api-keys.json");
const PREFIX = "quill_";
/** How stale "last used" may get before a request writes it again. */
const TOUCH_EVERY = 60_000;

type StoredKey = { id: string; name: string; hash: string; last4: string; createdAt: string; lastUsedAt: string | null; appId?: string };
type StoredApp = { id: string; name: string; hash: string; last4: string; approvedBy: string; createdAt: string; lastUsedAt: string | null };
type Store = { keys: StoredKey[]; apps: StoredApp[] };

/** What the portal and the API show. Never includes the key or its hash. `appId` is the app that issued it. */
export type ApiKeyInfo = { id: string; name: string; last4: string; createdAt: string | null; lastUsedAt: string | null; legacy: boolean; appId: string | null };
export type AppInfo = { id: string; name: string; last4: string; approvedBy: string; createdAt: string; lastUsedAt: string | null };

/** Who a key or token belongs to. */
export type Credential = { kind: "key"; id: string; name: string; appId: string | null } | { kind: "app"; id: string; name: string };

export const legacyKeys = () =>
  (process.env.QUILL_API_KEYS || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

const hash = (key: string) => createHash("sha256").update(key).digest("hex");
export const newSecret = () => PREFIX + randomBytes(32).toString("base64url");
const newId = () => randomBytes(6).toString("hex");

async function readStore(): Promise<Store> {
  try {
    const data = JSON.parse(await fs.readFile(KEYS_FILE, "utf8"));
    return { keys: Array.isArray(data.keys) ? data.keys : [], apps: Array.isArray(data.apps) ? data.apps : [] };
  } catch {
    return { keys: [], apps: [] };
  }
}

async function writeStore(store: Store) {
  await fs.mkdir(path.dirname(KEYS_FILE), { recursive: true });
  const tmp = `${KEYS_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  await fs.rename(tmp, KEYS_FILE);
}

// One change at a time, so a "last used" write can't undo a key made or revoked at the same moment.
// Kept on globalThis: each route is bundled separately, and they must all share one queue.
const shared = globalThis as unknown as { __quillKeyQueue?: Promise<unknown> };
function change<T>(fn: (store: Store) => Promise<T> | T): Promise<T> {
  const run = (shared.__quillKeyQueue ?? Promise.resolve()).then(async () => fn(await readStore()));
  shared.__quillKeyQueue = run.catch(() => undefined);
  return run;
}

const keyInfo = (k: StoredKey): ApiKeyInfo => ({ id: k.id, name: k.name, last4: k.last4, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt, legacy: false, appId: k.appId ?? null });
const appInfo = (a: StoredApp): AppInfo => ({ id: a.id, name: a.name, last4: a.last4, approvedBy: a.approvedBy, createdAt: a.createdAt, lastUsedAt: a.lastUsedAt });
const newestFirst = <T extends { createdAt: string | null }>(a: T, b: T) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "");

/** Every key: portal and app-issued keys (newest first), then legacy keys. */
export async function listKeys(): Promise<ApiKeyInfo[]> {
  const legacy = legacyKeys().map((k, i): ApiKeyInfo => ({ id: `env-${i + 1}`, name: "Set in QUILL_API_KEYS", last4: k.slice(-4), createdAt: null, lastUsedAt: null, legacy: true, appId: null }));
  return [...(await readStore()).keys.map(keyInfo).sort(newestFirst), ...legacy];
}

export async function listApps(): Promise<AppInfo[]> {
  return (await readStore()).apps.map(appInfo).sort(newestFirst);
}

/** The keys one connected app issued. */
export async function listAppKeys(appId: string): Promise<ApiKeyInfo[]> {
  return (await readStore()).keys.filter((k) => k.appId === appId).map(keyInfo).sort(newestFirst);
}

const cleanName = (name: unknown) => {
  const n = typeof name === "string" ? name.trim().slice(0, 80) : "";
  if (!n) throw new ContentError("Give the key a name, for example the bot that will use it.");
  return n;
};

/** Makes a key, issued by a connected app when `appId` is set. The returned `secret` is the only time it is shown. */
export async function createKey(name: unknown, appId?: string) {
  const label = cleanName(name);
  const secret = newSecret();
  const stored: StoredKey = { id: newId(), name: label, hash: hash(secret), last4: secret.slice(-4), createdAt: new Date().toISOString(), lastUsedAt: null, ...(appId ? { appId } : {}) };
  await change(async (store) => {
    if (appId && !store.apps.some((a) => a.id === appId)) throw new ContentError("This app has been disconnected.", 401);
    store.keys.push(stored);
    await writeStore(store);
  });
  return { key: keyInfo(stored), secret };
}

/** `appId` limits the change to that app's keys (a connected app can only touch its own). */
export async function renameKey(id: string, name: unknown, appId?: string) {
  const label = cleanName(name);
  return change(async (store) => {
    const k = store.keys.find((x) => x.id === id && (!appId || x.appId === appId));
    if (!k) throw new ContentError(id.startsWith("env-") ? "Keys set in QUILL_API_KEYS can't be renamed here." : "No key with that id.", 404);
    k.name = label;
    await writeStore(store);
    return keyInfo(k);
  });
}

/** Revokes a key: it stops working immediately. */
export async function revokeKey(id: string, appId?: string) {
  return change(async (store) => {
    if (!store.keys.some((x) => x.id === id && (!appId || x.appId === appId))) {
      throw new ContentError(id.startsWith("env-") ? "Keys set in QUILL_API_KEYS are revoked by removing them from the variable and restarting the server." : "No key with that id.", 404);
    }
    store.keys = store.keys.filter((x) => x.id !== id);
    await writeStore(store);
  });
}

/** Adds an approved connected app. The returned `token` is the only time it is available. */
export async function createApp(name: string, approvedBy: string) {
  const token = newSecret();
  const app: StoredApp = { id: newId(), name: name.trim().slice(0, 80) || "Connected app", hash: hash(token), last4: token.slice(-4), approvedBy, createdAt: new Date().toISOString(), lastUsedAt: null };
  await change(async (store) => {
    store.apps.push(app);
    await writeStore(store);
  });
  return { app: appInfo(app), token };
}

/** Disconnects an app and revokes every key it issued. */
export async function revokeApp(id: string) {
  return change(async (store) => {
    if (!store.apps.some((a) => a.id === id)) throw new ContentError("No connected app with that id.", 404);
    store.apps = store.apps.filter((a) => a.id !== id);
    store.keys = store.keys.filter((k) => k.appId !== id);
    await writeStore(store);
  });
}

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Who a key or app token belongs to, or null if it isn't valid. Records when it was last used. */
export async function verifyKey(key: string): Promise<Credential | null> {
  const legacy = legacyKeys().findIndex((k) => same(k, key));
  if (legacy >= 0) return { kind: "key", id: `env-${legacy + 1}`, name: "Legacy API key", appId: null };
  if (!key.startsWith(PREFIX)) return null;
  const h = hash(key);
  const store = await readStore();
  const k = store.keys.find((x) => same(x.hash, h));
  const a = k ? undefined : store.apps.find((x) => same(x.hash, h));
  const found = k ?? a;
  if (!found) return null;
  if (!found.lastUsedAt || Date.now() - Date.parse(found.lastUsedAt) > TOUCH_EVERY) {
    // Not awaited: a slow disk shouldn't slow the request.
    change(async (s) => {
      const x = k ? s.keys.find((y) => y.id === found.id) : s.apps.find((y) => y.id === found.id);
      if (!x) return;
      x.lastUsedAt = new Date().toISOString();
      await writeStore(s);
    }).catch((e) => console.error("Could not record API key use", e));
  }
  return k ? { kind: "key", id: k.id, name: k.name, appId: k.appId ?? null } : { kind: "app", id: a!.id, name: a!.name };
}
