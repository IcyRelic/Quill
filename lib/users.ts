import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { CONTENT_DIR, ContentError } from "./content";

/**
 * Admin portal accounts, in users.json next to the content. Passwords are stored as scrypt hashes.
 *
 * - Admins can do everything: accounts, API keys, connected apps, site settings and appearance.
 * - Editors can change pages, navigation, the home page and files.
 *
 * scripts/quill-user.mjs (the command line, used by the installer) reads and writes the same file. Keep the
 * file shape and the hash format in step with it.
 */

const USERS_FILE = path.join(CONTENT_DIR, "users.json");

export const ROLES = ["admin", "editor"] as const;
export type Role = (typeof ROLES)[number];

type StoredUser = {
  id: string;
  username: string;
  name: string;
  role: Role;
  /** scrypt$N$r$p$salt$hash, base64url. */
  password: string;
  /** Goes up when the password changes, which signs the account out everywhere. */
  sessionVersion: number;
  createdAt: string;
  lastSignInAt: string | null;
};
type Store = { users: StoredUser[] };

/** What the portal shows. Never includes the password hash. */
export type UserInfo = { id: string; username: string; name: string; role: Role; createdAt: string; lastSignInAt: string | null };

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;

const scrypt = (password: string, salt: Buffer, keylen: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => scryptCb(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key))));

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

async function checkHash(password: string, stored: string) {
  const [kind, n, r, p, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await scrypt(password, Buffer.from(salt, "base64url"), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return timingSafeEqual(key, expected);
}

// Compared against when a username doesn't exist, so a wrong username takes as long as a wrong password.
let dummyHash: Promise<string> | null = null;

async function readStore(): Promise<Store> {
  try {
    const data = JSON.parse(await fs.readFile(USERS_FILE, "utf8"));
    return { users: Array.isArray(data.users) ? data.users : [] };
  } catch {
    return { users: [] };
  }
}

async function writeStore(store: Store) {
  await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
  const tmp = `${USERS_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  await fs.rename(tmp, USERS_FILE);
}

// One change at a time, shared by every route bundle (see lib/keys.ts).
const shared = globalThis as unknown as { __quillUserQueue?: Promise<unknown> };
function change<T>(fn: (store: Store) => Promise<T> | T): Promise<T> {
  const run = (shared.__quillUserQueue ?? Promise.resolve()).then(async () => fn(await readStore()));
  shared.__quillUserQueue = run.catch(() => undefined);
  return run;
}

const info = (u: StoredUser): UserInfo => ({ id: u.id, username: u.username, name: u.name, role: u.role, createdAt: u.createdAt, lastSignInAt: u.lastSignInAt });

export function cleanUsername(value: unknown) {
  const u = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!/^[a-z0-9][a-z0-9._-]{1,31}$/.test(u)) throw new ContentError("Usernames are 2 to 32 characters: letters, numbers, dots, dashes and underscores.");
  return u;
}

const cleanName = (value: unknown, fallback: string) => (typeof value === "string" ? value.trim().slice(0, 80) : "") || fallback;

export function cleanPassword(value: unknown) {
  const p = typeof value === "string" ? value : "";
  if (p.length < 8) throw new ContentError("Passwords need at least 8 characters.");
  if (p.length > 200) throw new ContentError("Passwords can be up to 200 characters.");
  return p;
}

export function cleanRole(value: unknown): Role {
  if (!ROLES.includes(value as Role)) throw new ContentError(`role must be one of: ${ROLES.join(", ")}.`);
  return value as Role;
}

export async function listUsers(): Promise<UserInfo[]> {
  return (await readStore()).users.map(info).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function hasUsers() {
  return (await readStore()).users.length > 0;
}

/** The account a session belongs to, if it still exists and the session hasn't been signed out since. */
export async function sessionUser(id: string, sessionVersion: number): Promise<UserInfo | null> {
  const u = (await readStore()).users.find((x) => x.id === id);
  return u && u.sessionVersion === sessionVersion ? info(u) : null;
}

/** The account for a username and password, or null. Records the sign-in. */
export async function signIn(username: string, password: string): Promise<(UserInfo & { sessionVersion: number }) | null> {
  const name = typeof username === "string" ? username.trim().toLowerCase() : "";
  const u = (await readStore()).users.find((x) => x.username === name);
  if (!u) {
    dummyHash ??= hashPassword(randomBytes(12).toString("hex"));
    await checkHash(password, await dummyHash);
    return null;
  }
  if (!(await checkHash(password, u.password))) return null;
  change(async (s) => {
    const x = s.users.find((y) => y.id === u.id);
    if (!x) return;
    x.lastSignInAt = new Date().toISOString();
    await writeStore(s);
  }).catch((e) => console.error("Could not record sign-in", e));
  return { ...info(u), sessionVersion: u.sessionVersion };
}

export async function createUser(input: { username: unknown; name?: unknown; password: unknown; role: unknown }) {
  const username = cleanUsername(input.username);
  const password = await hashPassword(cleanPassword(input.password));
  const role = cleanRole(input.role);
  return change(async (store) => {
    if (store.users.some((u) => u.username === username)) throw new ContentError(`There is already an account called ${username}.`, 409);
    const user: StoredUser = { id: randomBytes(6).toString("hex"), username, name: cleanName(input.name, username), role, password, sessionVersion: 1, createdAt: new Date().toISOString(), lastSignInAt: null };
    store.users.push(user);
    await writeStore(store);
    return info(user);
  });
}

/** Changes an account's name, role or password. A new password signs the account out everywhere. */
export async function updateUser(id: string, input: { name?: unknown; role?: unknown; password?: unknown }) {
  const password = input.password !== undefined ? await hashPassword(cleanPassword(input.password)) : undefined;
  const role = input.role !== undefined ? cleanRole(input.role) : undefined;
  return change(async (store) => {
    const u = store.users.find((x) => x.id === id);
    if (!u) throw new ContentError("No account with that id.", 404);
    if (role && role !== "admin" && u.role === "admin" && store.users.filter((x) => x.role === "admin").length === 1) {
      throw new ContentError("This is the only admin. Make another account an admin first.", 409);
    }
    if (input.name !== undefined) u.name = cleanName(input.name, u.username);
    if (role) u.role = role;
    if (password) {
      u.password = password;
      u.sessionVersion += 1;
    }
    await writeStore(store);
    return { user: info(u), sessionVersion: u.sessionVersion };
  });
}

/** Changes your own password after checking the current one. */
export async function changeOwnPassword(id: string, current: unknown, next: unknown) {
  const u = (await readStore()).users.find((x) => x.id === id);
  if (!u || !(await checkHash(typeof current === "string" ? current : "", u.password))) throw new ContentError("Your current password isn’t right.", 403);
  return updateUser(id, { password: next });
}

export async function deleteUser(id: string, by: string) {
  if (id === by) throw new ContentError("You can’t remove your own account. Ask another admin.", 409);
  return change(async (store) => {
    const u = store.users.find((x) => x.id === id);
    if (!u) throw new ContentError("No account with that id.", 404);
    if (u.role === "admin" && store.users.filter((x) => x.role === "admin").length === 1) throw new ContentError("This is the only admin, so it can’t be removed.", 409);
    store.users = store.users.filter((x) => x.id !== id);
    await writeStore(store);
  });
}
