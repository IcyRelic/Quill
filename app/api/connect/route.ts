import { revokeApp } from "@/lib/keys";
import { handle, json, requireApp } from "@/lib/api";

export const dynamic = "force-dynamic";

/** A connected app disconnects itself, with its own token. Every key it issued is revoked too. */
export const DELETE = handle(async (req: Request) => {
  const app = await requireApp(req);
  await revokeApp(app.id);
  return json({ disconnected: true });
});
