import { listUploads, saveUpload, ContentError } from "@/lib/content";
import { handle, json, requireWriter } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requireWriter(req);
  return json({ uploads: await listUploads() });
});

/**
 * Upload a file. Either multipart/form-data with a "file" field,
 * or JSON { "name": "screen.png", "data": "<base64>" }. Returns { upload: { url } } to use in Markdown.
 */
export const POST = handle(async (req: Request) => {
  await requireWriter(req);
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ContentError('Send the file in a field named "file".');
    return json({ upload: await saveUpload(file.name, Buffer.from(await file.arrayBuffer())) }, 201);
  }
  const b = (await req.json()) as { name?: string; data?: string };
  if (!b?.name || !b.data) throw new ContentError('Send { "name": "file.png", "data": "<base64>" } or a multipart form.');
  return json({ upload: await saveUpload(b.name, Buffer.from(b.data.replace(/^data:[^,]+,/, ""), "base64")) }, 201);
});
