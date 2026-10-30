"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Page } from "@/lib/content";
import { groupOf, withoutSlug, type NavGroup } from "@/lib/nav";
import { withBase } from "@/lib/basePath";
import { adminFetch, uploadFile } from "./api";
import VisualEditor from "./editor/VisualEditor";

type Mode = "visual" | "markdown";
const MODE_KEY = "quill-editor-mode";

type Props = { initial: Page | null; initialGroup: string; groups: string[]; adminName: string };

const SNIPPETS: { label: string; text: string; wrap?: [string, string] }[] = [
  { label: "Heading", text: "\n## Heading\n" },
  { label: "Bold", text: "**bold**", wrap: ["**", "**"] },
  { label: "Link", text: "[text](/page)", wrap: ["[", "](/page)"] },
  { label: "Steps", text: "\n:::steps\n### First step\nWhat to do.\n\n### Second step\nWhat to do next.\n:::\n" },
  { label: "Tabs", text: "\n::::tabs\n:::tab[Mac]\nMac instructions.\n:::\n:::tab[Windows]\nWindows instructions.\n:::\n::::\n" },
  { label: "Note", text: "\n:::note\nSomething useful to know.\n:::\n" },
  { label: "Tip", text: "\n:::tip\nA quicker way.\n:::\n" },
  { label: "Warning", text: "\n:::warning\nWhat could go wrong.\n:::\n" },
  { label: "Important", text: "\n:::danger\nWhat readers must not miss.\n:::\n" },
  { label: "Question", text: "\n:::accordion[The question]\nThe answer.\n:::\n" },
  { label: "Key", text: ":kbd[Ctrl]" },
  { label: "Table", text: "\n| Column | Column |\n| --- | --- |\n| Cell | Cell |\n" },
];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9/]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");

export default function Editor({ initial, initialGroup, groups, adminName }: Props) {
  const router = useRouter();
  const isNew = !initial;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [group, setGroup] = useState(initialGroup);
  const [draft, setDraft] = useState(initial?.draft ?? isNew);
  const [body, setBody] = useState(initial?.body ?? "Write the first paragraph here.\n\n## A section\n");
  const [html, setHtml] = useState("");
  const bodyRef = useRef(body);
  bodyRef.current = body;
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>("visual");
  const [showPreview, setShowPreview] = useState(true);
  const [notice, setNotice] = useState("");
  const [linkStatus, setLinkStatus] = useState("");
  const [previewLink, setPreviewLink] = useState("");
  const flush = useRef<(() => string | null) | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const escaped = useRef(false);

  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setDirty(true);
  };

  useEffect(() => {
    try {
      if (localStorage.getItem(MODE_KEY) === "markdown") setMode("markdown");
    } catch {
      /* private window: start in visual mode */
    }
  }, []);

  const switchMode = (next: Mode) => {
    flush.current?.();
    setMode(next);
    setNotice("");
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* not remembered, that's all */
    }
  };

  // Live preview, beside the Markdown
  useEffect(() => {
    if (mode !== "markdown" || !showPreview) return;
    const t = setTimeout(async () => {
      try {
        const r = await adminFetch<{ html: string }>("/api/v1/preview", { method: "POST", json: { body } });
        setHtml(r.html);
      } catch {
        /* keep the last preview */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [body, mode, showPreview]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const insert = (text: string, wrap?: [string, string]) => {
    const el = area.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = body.slice(s, e);
    const piece = wrap && selected ? wrap[0] + selected + wrap[1] : text;
    const next = body.slice(0, s) + piece + body.slice(e);
    setBody(next);
    setDirty(true);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = s + piece.length;
    });
  };

  const save = useCallback(async () => {
    setError("");
    // A change typed in the visual editor a moment ago may not have reached `body` yet.
    const body = flush.current?.() ?? bodyRef.current;
    if (!title.trim()) return setError("Give the page a title.");
    if (!slug) return setError("Give the page an address.");
    setSaving(true);
    try {
      const target = slug;
      if (!isNew && initial && slug !== initial.slug) {
        await adminFetch(`/api/v1/pages/${initial.slug}`, { method: "PATCH", json: { newSlug: slug } });
      } else if (isNew) {
        await adminFetch("/api/v1/pages", { method: "POST", json: { slug, title, description, body, draft } });
      }
      if (!isNew) await adminFetch(`/api/v1/pages/${target}`, { method: "PUT", json: { title, description, body, draft } });
      // Place the page in the chosen sidebar group (or take it out).
      const { navigation } = await adminFetch<{ navigation: NavGroup[] }>("/api/v1/navigation");
      if ((groupOf(navigation, target) ?? "") !== group) {
        const next = withoutSlug(navigation, target);
        const dest = next.find((g) => g.title === group);
        if (dest) dest.pages.push(target);
        await adminFetch("/api/v1/navigation", { method: "PUT", json: { navigation: next } });
      }
      setDirty(false);
      setSavedAt(new Date());
      if (isNew || target !== initial?.slug) router.replace(`/admin/pages/edit?slug=${encodeURIComponent(target)}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [title, slug, isNew, initial, description, draft, group, router]);

  // Ctrl/Cmd+S saves
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [save]);

  const remove = async () => {
    if (!initial) return;
    if (!window.confirm(`Delete “${initial.title}” (/${initial.slug})? It will be removed from the site and the navigation. This can’t be undone.`)) return;
    try {
      await adminFetch(`/api/v1/pages/${initial.slug}`, { method: "DELETE" });
      setDirty(false);
      router.push("/admin");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  /** Copies the draft's shareable preview link, or (reset) makes a new one first so the old link stops working. */
  const copyPreview = async (reset: boolean) => {
    if (!initial) return;
    if (reset && !window.confirm("Make a new preview link? Anyone with the current link will no longer be able to see the draft.")) return;
    setError("");
    try {
      const { page } = reset
        ? await adminFetch<{ page: { previewUrl?: string } }>(`/api/v1/pages/${initial.slug}`, { method: "PATCH", json: { resetPreview: true } })
        : await adminFetch<{ page: { previewUrl?: string } }>(`/api/v1/pages/${initial.slug}`);
      if (!page.previewUrl) throw new Error("Save the page as a draft first.");
      setPreviewLink(page.previewUrl);
      const copied = await navigator.clipboard.writeText(page.previewUrl).then(
        () => true,
        () => false,
      );
      setLinkStatus(`${reset ? "New link made; the old one no longer works. " : ""}${copied ? "Copied." : "Copy it from the box above."}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      for (const f of Array.from(files)) {
        const up = await uploadFile(f);
        insert(f.type.startsWith("video/") ? `\n::video{src="${up.url}"}\n` : `![${f.name.replace(/\.[^.]+$/, "")}](${up.url})`);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const docHead = (
    <div className="a-doc-head">
      <input
        className="a-doc-title"
        aria-label="Title"
        placeholder="Page title"
        value={title}
        onChange={(e) => {
          touch(setTitle)(e.target.value);
          if (!slugTouched) setSlug(slugify(e.target.value));
        }}
      />
      <textarea
        className="a-doc-lead"
        aria-label="Description"
        placeholder="One sentence under the title. Also used in search results."
        rows={1}
        value={description}
        // One line of text that wraps, like the description on the page; Enter doesn't start a new line.
        onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
        onChange={(e) => touch(setDescription)(e.target.value.replace(/\n/g, " "))}
      />
    </div>
  );

  const status = saving ? "Saving…" : dirty ? "Unsaved changes" : savedAt ? `Saved at ${savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : isNew ? "Not saved yet" : "No changes";

  return (
    <div className="a-editor-screen">
      <div className="a-head a-editor-head">
        <div className="a-editor-crumbs">
          <a className="a-back" href={withBase("/admin")}>
            Pages
          </a>
          <span aria-hidden="true">/</span>
          <span className="a-editor-name">{isNew ? "New page" : title || "Untitled"}</span>
          <span className={`a-pill${dirty ? " a-pill-warn" : ""}`} aria-live="polite">
            {status}
          </span>
        </div>
        <div className="a-head-actions">
          <div className="a-seg" role="group" aria-label="Editor">
            <button type="button" aria-pressed={mode === "visual"} onClick={() => switchMode("visual")}>
              Visual
            </button>
            <button type="button" aria-pressed={mode === "markdown"} onClick={() => switchMode("markdown")}>
              Markdown
            </button>
          </div>
          {!isNew ? (
            <a className="a-btn" href={withBase(`/${initial!.slug}`)} target="_blank" rel="noreferrer">
              View page
            </a>
          ) : null}
          <button className="a-btn a-btn-primary" type="button" onClick={save} disabled={saving}>
            {draft ? "Save draft" : "Save and publish"}
          </button>
        </div>
      </div>
      {error ? (
        <p className="a-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="a-notice" role="status">
          {notice}
        </p>
      ) : null}

      <div className="a-editor">
        <div className="a-editor-main">
          {mode === "visual" ? (
            <VisualEditor
              header={docHead}
              markdown={body}
              flushRef={flush}
              upload={uploadFile}
              onChange={(md) => {
                if (md.trim() !== bodyRef.current.trim()) touch(setBody)(md);
              }}
              onUnsupported={(message) => {
                setMode("markdown");
                setNotice(message);
              }}
              onError={setError}
            />
          ) : (
            <>
              {docHead}
              <div className={`a-split${showPreview ? "" : " is-single"}`}>
                <div className="a-source-wrap">
                  <div className="a-tools" role="toolbar" aria-label="Insert">
                    {SNIPPETS.map((s) => (
                      <button key={s.label} type="button" className="a-btn a-btn-small" onClick={() => insert(s.text, s.wrap)}>
                        {s.label}
                      </button>
                    ))}
                    <button type="button" className="a-btn a-btn-small" onClick={() => fileInput.current?.click()}>
                      Image or video
                    </button>
                    <input ref={fileInput} type="file" accept="image/*,video/mp4,video/webm" multiple hidden onChange={(e) => onFiles(e.target.files)} />
                    <label className="a-check a-tools-end">
                      <input type="checkbox" checked={showPreview} onChange={(e) => setShowPreview(e.target.checked)} />
                      Preview
                    </label>
                  </div>
                  <textarea
                    ref={area}
                    className="a-source"
                    aria-label="Page content in Markdown"
                    value={body}
                    spellCheck
                    onChange={(e) => touch(setBody)(e.target.value)}
                    onDrop={(e) => {
                      if (e.dataTransfer.files.length) {
                        e.preventDefault();
                        onFiles(e.dataTransfer.files);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") escaped.current = true;
                      else if (e.key !== "Tab") escaped.current = false;
                      if (e.key === "Tab" && !e.shiftKey && !escaped.current) {
                        e.preventDefault();
                        insert("  ");
                      }
                    }}
                  />
                  <p className="a-hint">
                    Markdown, plus callouts, steps, tabs and questions. See{" "}
                    <a href={withBase("/pages/formatting")} target="_blank" rel="noreferrer">
                      Formatting
                    </a>
                    . Ctrl+S saves; Esc then Tab leaves the editor.
                  </p>
                </div>
                {showPreview ? (
                  <section className="a-preview" aria-label="Preview">
                    <div className="a-preview-label">
                      <span>Preview</span>
                      <span>/{slug}</span>
                    </div>
                    <p className="a-preview-title">{title || "Untitled"}</p>
                    {description ? <p className="doc-lead">{description}</p> : null}
                    <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
                  </section>
                ) : null}
              </div>
            </>
          )}
        </div>

        <aside className="a-editor-side" aria-label="Page settings">
          <div className="a-panel a-side-panel">
            <h2 className="a-panel-title">Page</h2>
            <div className="a-field">
              <label htmlFor="f-slug">Address</label>
              <div className="a-prefix">
                <span>/</span>
                <input
                  id="f-slug"
                  className="a-input"
                  value={slug}
                  aria-describedby="f-slug-hint"
                  onChange={(e) => {
                    setSlugTouched(true);
                    touch(setSlug)(slugify(e.target.value));
                  }}
                />
              </div>
              <span className="a-hint" id="f-slug-hint">
                Lowercase letters, numbers and hyphens. Use / for folders.
              </span>
            </div>
            <div className="a-field">
              <label htmlFor="f-group">Sidebar group</label>
              <select id="f-group" className="a-select" value={group} onChange={(e) => touch(setGroup)(e.target.value)}>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
                <option value="">Not in the sidebar</option>
              </select>
            </div>
            <label className="a-check a-field">
              <input type="checkbox" checked={draft} onChange={(e) => touch(setDraft)(e.target.checked)} />
              Draft (only signed-in editors can see it)
            </label>
            {initial?.draft ? (
              <div className="a-field">
                <span className="a-label">Preview link</span>
                <div className="a-input-row">
                  <button className="a-btn a-btn-small" type="button" onClick={() => copyPreview(false)}>
                    Copy preview link
                  </button>
                  <button className="a-btn a-btn-small" type="button" onClick={() => copyPreview(true)}>
                    Reset preview link
                  </button>
                </div>
                {previewLink ? <input className="a-input a-mono" readOnly aria-label="Preview link" value={previewLink} onFocus={(e) => e.target.select()} /> : null}
                <span className="a-hint" aria-live="polite">
                  {linkStatus || "Anyone with the link can read the last saved draft, without signing in."}
                </span>
              </div>
            ) : null}
            {initial ? (
              <dl className="a-facts">
                <dt>Last saved</dt>
                <dd>{new Date(savedAt ?? initial.updated).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</dd>
                <dt>Last edited by</dt>
                <dd>{savedAt ? adminName : (initial.updatedBy ?? "Unknown")}</dd>
                <dt>Words</dt>
                <dd>{body.split(/\s+/).filter(Boolean).length.toLocaleString()}</dd>
              </dl>
            ) : null}
          </div>

          {!isNew ? (
            <div className="a-danger-zone">
              <div>
                <strong>Delete this page</strong>
                <p>Removes it from the site and the sidebar. Links to it will stop working.</p>
              </div>
              <button type="button" className="a-btn a-btn-danger" onClick={remove}>
                Delete page
              </button>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
