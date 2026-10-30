import { promises as fs } from "node:fs";
import path from "node:path";
import { UPLOADS_DIR, uploadType } from "@/lib/content";

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const name = decodeURIComponent((await ctx.params).name);
  const type = uploadType(name);
  if (!type || name !== path.basename(name)) return new Response("Not found", { status: 404 });
  try {
    const data = await fs.readFile(path.join(UPLOADS_DIR, name));
    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": type,
        "cache-control": "public, max-age=3600",
        "x-content-type-options": "nosniff",
        // SVGs can carry script; never let one run as a page.
        ...(type === "image/svg+xml" ? { "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" } : {}),
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
