import { pollConnect } from "@/lib/connect";
import { getSite } from "@/lib/content";
import { handle, json, body } from "@/lib/api";

export const dynamic = "force-dynamic";

/** 202 while waiting, 200 with the token once (approved), 403 if denied, 410 if expired, unknown or collected. */
export const POST = handle(async (req: Request) => {
  const b = await body<{ code?: string; secret?: string }>(req);
  const r = pollConnect(b.code, b.secret, (await getSite()).name);
  return json(r.body, r.status);
});
