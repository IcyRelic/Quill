"use client";

import { useState } from "react";
import type { ApiKeyInfo, AppInfo } from "@/lib/keys";
import { adminFetch } from "./api";

const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const when = (iso: string | null, never = "Never") => (iso ? fmt.format(new Date(iso)) : never);

export default function ApiKeys({ initial, initialApps }: { initial: ApiKeyInfo[]; initialApps: AppInfo[] }) {
  const [keys, setKeys] = useState(initial);
  const [apps, setApps] = useState(initialApps);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fresh, setFresh] = useState<{ name: string; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const reload = async () => {
    const r = await adminFetch<{ keys: ApiKeyInfo[]; apps: AppInfo[] }>("/api/v1/keys");
    setKeys(r.keys);
    setApps(r.apps);
  };

  const disconnect = async (a: AppInfo) => {
    const n = keys.filter((k) => k.appId === a.id).length;
    if (!window.confirm(`Disconnect “${a.name}”? Its token${n ? ` and the ${n} ${n === 1 ? "key" : "keys"} it made` : ""} will stop working at once. This can’t be undone.`)) return;
    setError("");
    try {
      await adminFetch(`/api/v1/connections/${a.id}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await adminFetch<{ key: ApiKeyInfo; secret: string }>("/api/v1/keys", { method: "POST", json: { name } });
      setFresh({ name: r.key.name, secret: r.secret });
      setCopied(false);
      setName("");
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (k: ApiKeyInfo) => {
    if (!window.confirm(`Revoke “${k.name}” (…${k.last4})? Anything using it will stop working at once. This can’t be undone.`)) return;
    setError("");
    try {
      await adminFetch(`/api/v1/keys/${k.id}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const rename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renaming) return;
    setError("");
    try {
      await adminFetch(`/api/v1/keys/${renaming.id}`, { method: "PATCH", json: { name: renaming.name } });
      setRenaming(null);
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const copy = async () => {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh.secret);
      setCopied(true);
    } catch {
      setError("Couldn’t copy. Select the key and copy it by hand.");
    }
  };

  const made = keys.filter((k) => !k.legacy && !k.appId);
  const legacy = keys.filter((k) => k.legacy);

  const keyRow = (k: ApiKeyInfo) => (
    <tr key={k.id}>
      <td>
        {renaming?.id === k.id ? (
          <form className="a-input-row" onSubmit={rename}>
            <input className="a-input" autoFocus aria-label="Key name" value={renaming.name} maxLength={80} onChange={(e) => setRenaming({ id: k.id, name: e.target.value })} onKeyDown={(e) => e.key === "Escape" && setRenaming(null)} />
            <button className="a-btn a-btn-small a-btn-primary" type="submit">
              Save
            </button>
          </form>
        ) : (
          <strong>{k.name}</strong>
        )}
      </td>
      <td>
        <span className="a-key">…{k.last4}</span>
      </td>
      <td className="a-hide-sm">{when(k.createdAt)}</td>
      <td>{when(k.lastUsedAt)}</td>
      <td className="a-num">
        <div className="a-row-actions">
          <button className="a-btn a-btn-small" type="button" onClick={() => setRenaming({ id: k.id, name: k.name })}>
            Rename
          </button>
          <button className="a-btn a-btn-small a-btn-danger" type="button" onClick={() => revoke(k)}>
            Revoke
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="a-keys-screen">
      {error ? (
        <p className="a-error" role="alert">
          {error}
        </p>
      ) : null}

      {fresh ? (
        <div className="a-secret" role="status">
          <div>
            <strong>Copy the key for “{fresh.name}” now.</strong>
            <p>This is the only time it is shown. Quill keeps a fingerprint of it, not the key itself.</p>
          </div>
          <div className="a-input-row">
            <input className="a-input a-mono" readOnly value={fresh.secret} aria-label="New API key" onFocus={(e) => e.target.select()} />
            <button className="a-btn a-btn-primary" type="button" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </button>
            <button className="a-btn" type="button" onClick={() => setFresh(null)}>
              Done
            </button>
          </div>
        </div>
      ) : null}

      <form className="a-panel a-key-form" onSubmit={create}>
        <div className="a-field">
          <label htmlFor="k-name">New key</label>
          <div className="a-input-row">
            <input id="k-name" className="a-input" placeholder="Who will use it, for example InkBot: Juniper" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-describedby="k-name-hint" />
            <button className="a-btn a-btn-primary" type="submit" disabled={busy || !name.trim()}>
              Create key
            </button>
          </div>
          <span className="a-hint" id="k-name-hint">
            A key can read drafts and change pages, navigation, settings and files. One key per bot or script makes it easy to revoke just one.
          </span>
        </div>
      </form>

      <table className="a-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Key</th>
            <th className="a-hide-sm">Created</th>
            <th>Last used</th>
            <th className="a-num">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {made.map(keyRow)}
          {legacy.map((k) => (
            <tr key={k.id} className="a-row-muted">
              <td>
                <strong>Legacy key</strong>
                <span className="a-hint a-block">Set in the server’s QUILL_API_KEYS. Still works; read-only here.</span>
              </td>
              <td>
                <span className="a-key">…{k.last4}</span>
              </td>
              <td className="a-hide-sm">Before keys moved here</td>
              <td>Not tracked</td>
              <td className="a-num">
                <span className="a-hint">Remove from QUILL_API_KEYS to revoke</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!made.length && !legacy.length ? <p className="a-empty">No keys made here yet.</p> : null}

      <h2 className="a-section-title">Connected apps</h2>
      <p className="a-hint">
        Apps such as InkBot connect with a code you approve, then make a key for each of their bots. Disconnecting an app revokes its token and every key it made.
      </p>
      {apps.length ? (
        <div className="a-apps">
          {apps.map((a) => {
            const appKeys = keys.filter((k) => k.appId === a.id);
            return (
              <section className="a-app-card" key={a.id} aria-label={a.name}>
                <div className="a-app-head">
                  <div>
                    <strong>{a.name}</strong>
                    <span className="a-hint a-block">
                      Approved by {a.approvedBy} on {when(a.createdAt)} · token …{a.last4} · last used {when(a.lastUsedAt, "never")}
                    </span>
                  </div>
                  <button className="a-btn a-btn-small a-btn-danger" type="button" onClick={() => disconnect(a)}>
                    Disconnect
                  </button>
                </div>
                {appKeys.length ? (
                  <table className="a-table a-table-tight">
                    <thead>
                      <tr>
                        <th>Key</th>
                        <th>Ends in</th>
                        <th className="a-hide-sm">Created</th>
                        <th>Last used</th>
                        <th className="a-num">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>{appKeys.map(keyRow)}</tbody>
                  </table>
                ) : (
                  <p className="a-hint">It hasn’t made any keys yet.</p>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <p className="a-empty">No apps connected. An app shows a code and a link to approve it here.</p>
      )}
    </div>
  );
}
