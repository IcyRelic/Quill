#!/usr/bin/env node
/**
 * Manage admin portal accounts from the command line, for example to make the first one.
 *
 *   node scripts/quill-user.mjs add [--username name] [--name "Display name"] [--role admin|editor]
 *   node scripts/quill-user.mjs list
 *   node scripts/quill-user.mjs passwd <username>
 *   node scripts/quill-user.mjs role <username> <admin|editor>
 *   node scripts/quill-user.mjs remove <username>
 *   node scripts/quill-user.mjs count
 *
 * Asks for anything missing when run in a terminal. Otherwise the password is read from the first line of
 * standard input, so scripts can pipe it in without it showing up in the process list.
 *
 * It edits users.json in the content folder (QUILL_CONTENT_DIR, default ./content), in the same format as
 * lib/users.ts. Keep the two in step. A running server picks changes up on the next request.
 */
import { randomBytes, scryptSync } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import readline from "node:readline";

const CONTENT_DIR = path.resolve(process.env.QUILL_CONTENT_DIR || path.join(process.cwd(), "content"));
const USERS_FILE = path.join(CONTENT_DIR, "users.json");
const ROLES = ["admin", "editor"];

class UsageError extends Error {}

function hashPassword(password) {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

async function readStore() {
  try {
    const data = JSON.parse(await fs.readFile(USERS_FILE, "utf8"));
    return { users: Array.isArray(data.users) ? data.users : [] };
  } catch (e) {
    if (e.code === "ENOENT") return { users: [] };
    throw e;
  }
}

async function writeStore(store) {
  await fs.mkdir(CONTENT_DIR, { recursive: true });
  const tmp = `${USERS_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  await fs.rename(tmp, USERS_FILE);
}

function cleanUsername(value) {
  const u = String(value ?? "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,31}$/.test(u)) throw new UsageError("Usernames are 2 to 32 characters: letters, numbers, dots, dashes and underscores.");
  return u;
}

function cleanPassword(value) {
  if (value.length < 8) throw new UsageError("Passwords need at least 8 characters.");
  if (value.length > 200) throw new UsageError("Passwords can be up to 200 characters.");
  return value;
}

function cleanRole(value) {
  if (!ROLES.includes(value)) throw new UsageError(`The role must be one of: ${ROLES.join(", ")}.`);
  return value;
}

const interactive = process.stdin.isTTY && process.stdout.isTTY;

function ask(question, fallback = "") {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(fallback ? `${question} [${fallback}]: ` : `${question}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || fallback);
    }),
  );
}

/** Reads a password without echoing it. */
function askHidden(question) {
  return new Promise((resolve, reject) => {
    process.stdout.write(`${question}: `);
    const stdin = process.stdin;
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n" || ch === "\u0004") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(value);
        }
        if (ch === "\u0003") {
          stdin.setRawMode(false);
          process.stdout.write("\n");
          return reject(new UsageError("Cancelled."));
        }
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

let stdinLines = null;
async function stdinLine() {
  if (!stdinLines) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    stdinLines = Buffer.concat(chunks).toString("utf8").split(/\r?\n/);
  }
  return stdinLines.shift() ?? "";
}

async function newPassword() {
  if (!interactive) return cleanPassword(await stdinLine());
  for (;;) {
    try {
      const first = cleanPassword(await askHidden("Password (at least 8 characters)"));
      if ((await askHidden("Password again")) === first) return first;
      console.error("The passwords don’t match. Try again.");
    } catch (e) {
      if (!(e instanceof UsageError) || e.message === "Cancelled.") throw e;
      console.error(e.message);
    }
  }
}

function flags(args) {
  const out = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=", 2);
      out[k] = v ?? args[++i];
    } else out._.push(a);
  }
  return out;
}

const find = (store, username) => {
  const u = store.users.find((x) => x.username === cleanUsername(username));
  if (!u) throw new UsageError(`There is no account called ${username}.`);
  return u;
};
const admins = (store) => store.users.filter((u) => u.role === "admin").length;

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const opts = flags(rest);
  const store = await readStore();

  switch (command) {
    case "add": {
      const username = cleanUsername(opts.username ?? (interactive ? await ask("Username") : ""));
      if (store.users.some((u) => u.username === username)) throw new UsageError(`There is already an account called ${username}.`);
      const name = String(opts.name ?? (interactive ? await ask("Name shown on edits", username) : "")).trim().slice(0, 80) || username;
      const role = cleanRole(opts.role ?? (interactive ? await ask("Role (admin or editor)", store.users.length ? "editor" : "admin") : store.users.length ? "editor" : "admin"));
      const password = hashPassword(await newPassword());
      store.users.push({ id: randomBytes(6).toString("hex"), username, name, role, password, sessionVersion: 1, createdAt: new Date().toISOString(), lastSignInAt: null });
      await writeStore(store);
      console.log(`Added ${username} (${role}).`);
      break;
    }
    case "list": {
      if (!store.users.length) console.log("No accounts yet. Add one with: add");
      for (const u of store.users) console.log(`${u.username.padEnd(20)} ${u.role.padEnd(7)} ${u.name}`);
      break;
    }
    case "count":
      console.log(store.users.length);
      break;
    case "passwd": {
      const u = find(store, opts._[0] ?? (interactive ? await ask("Username") : ""));
      u.password = hashPassword(await newPassword());
      u.sessionVersion = (u.sessionVersion ?? 1) + 1;
      await writeStore(store);
      console.log(`New password set for ${u.username}. It has been signed out everywhere.`);
      break;
    }
    case "role": {
      const u = find(store, opts._[0]);
      const role = cleanRole(opts._[1]);
      if (u.role === "admin" && role !== "admin" && admins(store) === 1) throw new UsageError("This is the only admin. Make another account an admin first.");
      u.role = role;
      await writeStore(store);
      console.log(`${u.username} is now ${role === "admin" ? "an admin" : "an editor"}.`);
      break;
    }
    case "remove": {
      const u = find(store, opts._[0]);
      if (u.role === "admin" && admins(store) === 1) throw new UsageError("This is the only admin, so it can’t be removed.");
      store.users = store.users.filter((x) => x.id !== u.id);
      await writeStore(store);
      console.log(`Removed ${u.username}.`);
      break;
    }
    default:
      console.log("Usage: quill-user.mjs <add|list|passwd|role|remove|count> [options]\n");
      console.log("  add [--username name] [--name \"Display name\"] [--role admin|editor]");
      console.log("  list");
      console.log("  passwd <username>");
      console.log("  role <username> <admin|editor>");
      console.log("  remove <username>");
      console.log("  count");
      if (command && command !== "help" && command !== "--help") process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e instanceof UsageError ? e.message : e);
  process.exitCode = 1;
});
