import { revokeApp } from "@/lib/keys";
import { handle, json, requireAdmin } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Disconnect an app from the admin portal: its token and every key it issued stop working. Admin session only. */
export const DELETE = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  await revokeApp(id);
  return json({ disconnected: id });
});
