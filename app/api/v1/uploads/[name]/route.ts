import { deleteUpload } from "@/lib/content";
import { handle, json, requireWriter } from "@/lib/api";

export const dynamic = "force-dynamic";

export const DELETE = handle(async (req: Request, ctx: { params: Promise<{ name: string }> }) => {
  await requireWriter(req);
  const name = decodeURIComponent((await ctx.params).name);
  await deleteUpload(name);
  return json({ deleted: name });
});
