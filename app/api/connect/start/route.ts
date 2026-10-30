import { startConnect, EXPIRES_IN, INTERVAL } from "@/lib/connect";
import { handle, json, body, publicOrigin } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Starts pairing an app. No key needed: an admin approves the code in the portal. */
export const POST = handle(async (req: Request) => {
  const b = await body<{ client_name?: string }>(req).catch(() => ({}) as { client_name?: string });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  const { code, secret } = startConnect(b.client_name, ip);
  const verify_url = `${await publicOrigin(req)}/admin/connect?code=${encodeURIComponent(code)}`;
  return json({ code, secret, verify_url, expires_in: EXPIRES_IN, interval: INTERVAL });
});
