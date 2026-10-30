"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SiteConfig, SiteLink } from "@/lib/content";
import { adminFetch } from "./api";

/**
 * Local edits to some site settings, saved with PATCH /api/v1/site. Each screen sends only the settings it
 * shows, so two screens (or a bot) changing different settings never undo each other.
 */
export function useSiteDraft<K extends keyof SiteConfig>(initial: SiteConfig, keys: K[]) {
  const router = useRouter();
  const [site, setSite] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const set = (fn: (s: SiteConfig) => SiteConfig) => {
    setSite(fn);
    setDirty(true);
    setStatus("");
  };

  const save = async () => {
    setError("");
    setSaving(true);
    try {
      const patch = Object.fromEntries(keys.map((k) => [k, site[k]]));
      const { site: saved } = await adminFetch<{ site: SiteConfig }>("/api/v1/site", { method: "PATCH", json: patch });
      setSite(saved);
      setDirty(false);
      setStatus("Saved");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  return { site, set, dirty, saving, status, error, setError, save };
}

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="a-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? (
        <span className="a-hint" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function Section({ title, description, children }: { title: string; description: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="a-setting">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

export function ScreenHead({ title, sub, children }: { title: string; sub: string; children?: React.ReactNode }) {
  return (
    <div className="a-head">
      <div>
        <h1>{title}</h1>
        <p className="a-sub">{sub}</p>
      </div>
      {children ? <div className="a-head-actions">{children}</div> : null}
    </div>
  );
}

export function SaveBar({ dirty, saving, status, onSave, label = "Save changes" }: { dirty: boolean; saving: boolean; status: string; onSave: () => void; label?: string }) {
  // Ctrl/Cmd+S saves, as in the page editor.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty && !saving) onSave();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [dirty, saving, onSave]);
  return (
    <div className="a-savebar">
      <span className="a-saved" aria-live="polite">
        {saving ? "Saving…" : dirty ? "Unsaved changes" : status}
      </span>
      <button className="a-btn a-btn-primary" type="button" onClick={onSave} disabled={!dirty || saving}>
        {label}
      </button>
    </div>
  );
}

/** Rows of label + address, with reordering. */
export function LinksEditor({ links, max, onChange, name }: { links: SiteLink[]; max?: number; onChange: (links: SiteLink[]) => void; name: string }) {
  const move = (i: number, d: number) => {
    const to = i + d;
    if (to < 0 || to >= links.length) return;
    const next = [...links];
    [next[i], next[to]] = [next[to], next[i]];
    onChange(next);
  };
  return (
    <div className="a-links">
      {links.map((l, i) => (
        <div className="a-link-row" key={i}>
          <input className="a-input" aria-label={`${name} ${i + 1} label`} placeholder="Label" value={l.label} onChange={(e) => onChange(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <input className="a-input" aria-label={`${name} ${i + 1} address`} placeholder="/page or https://…" value={l.href} onChange={(e) => onChange(links.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)))} />
          <div className="a-row-actions">
            <button className="a-btn a-btn-small a-icon-btn" type="button" aria-label={`Move ${l.label || "link"} up`} disabled={i === 0} onClick={() => move(i, -1)}>
              ↑
            </button>
            <button className="a-btn a-btn-small a-icon-btn" type="button" aria-label={`Move ${l.label || "link"} down`} disabled={i === links.length - 1} onClick={() => move(i, 1)}>
              ↓
            </button>
            <button className="a-btn a-btn-small" type="button" onClick={() => onChange(links.filter((_, j) => j !== i))}>
              Remove
            </button>
          </div>
        </div>
      ))}
      {!links.length ? <p className="a-hint">No links yet.</p> : null}
      {max === undefined || links.length < max ? (
        <button className="a-btn a-btn-small a-add" type="button" onClick={() => onChange([...links, { label: "Link", href: "/" }])}>
          Add link
        </button>
      ) : null}
    </div>
  );
}
