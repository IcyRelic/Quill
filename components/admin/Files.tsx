"use client";

import { useState } from "react";
import { withBase } from "@/lib/basePath";
import { adminFetch, uploadFile } from "./api";

type Upload = { name: string; url: string; size: number; updated: string };

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const snippet = (u: Upload) => (/\.(mp4|webm)$/.test(u.name) ? `::video{src="${u.url}"}` : /\.pdf$/.test(u.name) ? `[${u.name}](${u.url})` : `![Describe the picture](${u.url})`);

export default function Files({ initial }: { initial: Upload[] }) {
  const [files, setFiles] = useState(initial);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const refresh = async () => setFiles((await adminFetch<{ uploads: Upload[] }>("/api/v1/uploads")).uploads);
  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    setError("");
    try {
      for (const f of Array.from(list)) await uploadFile(f);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="a-head">
        <div>
          <h1>Files</h1>
          <p className="a-sub">
            {files.length} {files.length === 1 ? "file" : "files"}. Pictures, videos and PDFs to use in pages, up to 15 MB each.
          </p>
        </div>
        <label className="a-btn a-btn-primary">
          {busy ? "Uploading…" : "Upload files"}
          <input type="file" multiple hidden accept="image/*,video/mp4,video/webm,application/pdf" onChange={(e) => add(e.target.files)} />
        </label>
      </div>
      {error ? (
        <p className="a-error" role="alert">
          {error}
        </p>
      ) : null}
      <div
        className={`a-drop${over ? " is-over" : ""}${files.length ? "" : " is-empty"}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
      >
        {files.length ? (
          "Drop files here to upload them"
        ) : (
          <>
            <strong style={{ color: "var(--ink)", fontSize: 16 }}>No files yet</strong>
            <span>Drop screenshots, videos or PDFs here, or choose Upload files. Each one gets an address to use in a page.</span>
          </>
        )}
      </div>
      <div className="a-files">
        {files.map((f) => (
          <div className="a-file" key={f.name}>
            <div className="a-file-thumb">{/\.(mp4|webm)$/.test(f.name) ? <video src={withBase(f.url)} muted /> : /\.pdf$/.test(f.name) ? "PDF" : <img src={withBase(f.url)} alt="" loading="lazy" />}</div>
            <div className="a-file-body">
              <p className="a-file-name" title={f.name}>
                {f.name}
              </p>
              <p className="a-hint">{kb(f.size)}</p>
              <div className="a-file-actions">
                <button
                  className="a-btn a-btn-small"
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(snippet(f));
                    setCopied(f.name);
                    setTimeout(() => setCopied(""), 1500);
                  }}
                >
                  {copied === f.name ? "Copied" : "Copy Markdown"}
                </button>
                <button
                  className="a-btn a-btn-small a-btn-danger"
                  type="button"
                  onClick={async () => {
                    if (!window.confirm(`Delete ${f.name}? Pages that show it will have a broken picture.`)) return;
                    try {
                      await adminFetch(`/api/v1/uploads/${encodeURIComponent(f.name)}`, { method: "DELETE" });
                      await refresh();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
