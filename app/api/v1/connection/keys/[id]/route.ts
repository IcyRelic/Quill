import { renameKey, revokeKey } from "@/lib/keys";
import { handle, json, requireApp, body } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Rename one of this app's keys. */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const app = await requireApp(req);
  const { id } = await ctx.params;
  const { name } = await body<{ name?: string }>(req);
  return json({ key: await renameKey(id, name, app.id) });
});

/** Revoke one of this app's keys. */
export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const app = await requireApp(req);
  const { id } = await ctx.params;
  await revokeKey(id, app.id);
  return json({ revoked: id });
});
