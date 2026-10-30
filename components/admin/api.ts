"use client";

import { stripBase, withBase } from "@/lib/basePath";

/** fetch() for the admin portal: sends the session cookie plus the header that marks it as a portal call. */
export async function adminFetch<T = unknown>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(withBase(url), {
    ...rest,
    credentials: "same-origin",
    headers: { "x-quill-admin": "1", ...(json !== undefined ? { "content-type": "application/json" } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    window.location.href = withBase(`/admin/login?next=${encodeURIComponent(stripBase(location.pathname) + location.search)}`);
  }
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

export async function uploadFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  const data = await adminFetch<{ upload: { url: string; name: string } }>("/api/v1/uploads", { method: "POST", body: form });
  return data.upload;
}
