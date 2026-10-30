import { decideConnect } from "@/lib/connect";
import { handle, json, body, requireAdmin, refreshSite } from "@/lib/api";

export const dynamic = "force-dynamic";

/** The admin portal's Approve or Deny. Admin session only. */
export const POST = handle(async (req: Request) => {
  const caller = await requireAdmin(req);
  const b = await body<{ code?: string; approve?: boolean }>(req);
  const result = await decideConnect(b.code ?? "", b.approve === true, caller.name);
  refreshSite();
  return json(result);
});
