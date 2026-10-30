"use client";

import { useState } from "react";
import type { Role, UserInfo } from "@/lib/users";
import { adminFetch } from "./api";

const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const when = (iso: string | null) => (iso ? fmt.format(new Date(iso)) : "Never");

const ROLE_HINT: Record<Role, string> = {
  admin: "Admins can do everything, including accounts, API keys, site settings and appearance.",
  editor: "Editors can change pages, navigation, the home page and files.",
};

const blank = { username: "", name: "", password: "", role: "editor" as Role };

export default function Users({ initial, me }: { initial: UserInfo[]; me: string }) {
  const [users, setUsers] = useState(initial);
  const [draft, setDraft] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [resetting, setResetting] = useState<{ id: string; password: string } | null>(null);

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setError("");
    setStatus("");
    try {
      await fn();
      setUsers((await adminFetch<{ users: UserInfo[] }>("/api/v1/users")).users);
      if (done) setStatus(done);
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await run(() => adminFetch("/api/v1/users", { method: "POST", json: draft }), `Added ${draft.username.trim().toLowerCase()}. Give them their username and password.`);
    if (ok) setDraft(blank);
    setBusy(false);
  };

  const setRole = (u: UserInfo, role: Role) => run(() => adminFetch(`/api/v1/users/${u.id}`, { method: "PATCH", json: { role } }), `${u.name} is now ${role === "admin" ? "an admin" : "an editor"}.`);

  const setPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetting) return;
    const u = users.find((x) => x.id === resetting.id);
    const ok = await run(() => adminFetch(`/api/v1/users/${resetting.id}`, { method: "PATCH", json: { password: resetting.password } }), `New password set for ${u?.name}. They’ve been signed out everywhere.`);
    if (ok) setResetting(null);
  };

  const remove = (u: UserInfo) => {
    if (!window.confirm(`Remove ${u.name} (${u.username})? They’re signed out at once. Pages keep their name as the last editor.`)) return;
    run(() => adminFetch(`/api/v1/users/${u.id}`, { method: "DELETE" }), `Removed ${u.name}.`);
  };

  return (
    <div className="a-keys-screen">
      {error ? (
        <p className="a-error" role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="a-hint" role="status">
          {status}
        </p>
      ) : null}

      <form className="a-panel a-key-form" onSubmit={create}>
        <div className="a-two">
          <div className="a-field">
            <label htmlFor="u-username">Username</label>
            <input id="u-username" className="a-input" autoComplete="off" autoCapitalize="none" spellCheck={false} required value={draft.username} maxLength={32} onChange={(e) => setDraft({ ...draft, username: e.target.value })} aria-describedby="u-username-hint" />
            <span className="a-hint" id="u-username-hint">
              What they sign in with. Letters, numbers, dots, dashes and underscores.
            </span>
          </div>
          <div className="a-field">
            <label htmlFor="u-name">Name</label>
            <input id="u-name" className="a-input" autoComplete="off" value={draft.name} maxLength={80} onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-describedby="u-name-hint" />
            <span className="a-hint" id="u-name-hint">
              Shown as “Last edited by”. Optional; the username is used if empty.
            </span>
          </div>
        </div>
        <div className="a-two">
          <div className="a-field">
            <label htmlFor="u-password">Password</label>
            <input id="u-password" className="a-input" type="password" autoComplete="new-password" required minLength={8} value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} aria-describedby="u-password-hint" />
            <span className="a-hint" id="u-password-hint">
              At least 8 characters. They can change it under Your account.
            </span>
          </div>
          <div className="a-field">
            <label htmlFor="u-role">Role</label>
            <select id="u-role" className="a-select" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })} aria-describedby="u-role-hint">
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
            <span className="a-hint" id="u-role-hint">
              {ROLE_HINT[draft.role]}
            </span>
          </div>
        </div>
        <button className="a-btn a-btn-primary a-add" type="submit" disabled={busy || !draft.username.trim() || draft.password.length < 8}>
          Add account
        </button>
      </form>

      <table className="a-table">
        <thead>
          <tr>
            <th>Name</th>
            <th className="a-hide-sm">Username</th>
            <th>Role</th>
            <th className="a-hide-sm">Last signed in</th>
            <th className="a-num">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                <strong>{u.name}</strong> {u.id === me ? <span className="a-pill">You</span> : null}
              </td>
              <td className="a-hide-sm">
                <span className="a-key">{u.username}</span>
              </td>
              <td>
                <select className="a-select" aria-label={`Role for ${u.name}`} value={u.role} onChange={(e) => setRole(u, e.target.value as Role)}>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
              <td className="a-hide-sm">{when(u.lastSignInAt)}</td>
              <td className="a-num">
                {resetting?.id === u.id ? (
                  <form className="a-input-row" onSubmit={setPassword}>
                    <input className="a-input" type="password" autoFocus autoComplete="new-password" minLength={8} aria-label={`New password for ${u.name}`} placeholder="New password" value={resetting.password} onChange={(e) => setResetting({ id: u.id, password: e.target.value })} onKeyDown={(e) => e.key === "Escape" && setResetting(null)} />
                    <button className="a-btn a-btn-small a-btn-primary" type="submit" disabled={resetting.password.length < 8}>
                      Set
                    </button>
                  </form>
                ) : (
                  <div className="a-row-actions">
                    {u.id === me ? null : (
                      <>
                        <button className="a-btn a-btn-small" type="button" onClick={() => setResetting({ id: u.id, password: "" })}>
                          Set password
                        </button>
                        <button className="a-btn a-btn-small a-btn-danger" type="button" onClick={() => remove(u)}>
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
