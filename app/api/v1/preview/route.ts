import { renderMarkdown } from "@/lib/markdown";
import { handle, json, requireWriter, body } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Render Markdown without saving it. Body: { "body": "# Markdown" } */
export const POST = handle(async (req: Request) => {
  await requireWriter(req);
  const b = await body<{ body?: string }>(req);
  return json(await renderMarkdown(b.body ?? ""));
});
