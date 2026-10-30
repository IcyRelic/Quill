import { renameKey, revokeKey } from "@/lib/keys";
import { handle, json, requireAdmin, body } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Rename a key. Admin session only. */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const { name } = await body<{ name?: string }>(req);
  return json({ key: await renameKey(id, name) });
});

/** Revoke a key: it stops working at once. Admin session only. */
export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  await revokeKey(id);
  return json({ revoked: id });
});
