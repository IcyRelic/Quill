import { createKey, listApps, listKeys } from "@/lib/keys";
import { handle, json, requireAdmin, body } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Every key (portal keys and keys connected apps issued, then legacy keys from QUILL_API_KEYS) and every
 * connected app. Admin session only.
 */
export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const [keys, apps] = await Promise.all([listKeys(), listApps()]);
  return json({ keys, apps });
});

/** Make a key. The response's `secret` is the only time the key is shown. Admin session only. */
export const POST = handle(async (req: Request) => {
  await requireAdmin(req);
  const { name } = await body<{ name?: string }>(req);
  return json(await createKey(name), 201);
});
