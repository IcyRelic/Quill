import { createKey, listAppKeys } from "@/lib/keys";
import { handle, json, requireApp, body } from "@/lib/api";

export const dynamic = "force-dynamic";

/** The keys this connected app issued. Its own token only. */
export const GET = handle(async (req: Request) => {
  const app = await requireApp(req);
  return json({ keys: await listAppKeys(app.id) });
});

/** Issue a key (for one of the app's bots). The response's `secret` is the only time it is shown. */
export const POST = handle(async (req: Request) => {
  const app = await requireApp(req);
  const { name } = await body<{ name?: string }>(req);
  return json(await createKey(name, app.id), 201);
});
