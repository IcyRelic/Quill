import { cookies } from "next/headers";
import { createSessionToken, getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { BASE } from "@/lib/basePath";
import { handle, json, requireUser, body, isHttps } from "@/lib/api";
import { changeOwnPassword, updateUser } from "@/lib/users";

export const dynamic = "force-dynamic";

/** The signed-in account. */
export const GET = handle(async (req: Request) => {
  await requireUser(req);
  return json({ user: await getSessionUser() });
});

/**
 * Changes your own name, or your password. Body: { "name" } or { "currentPassword", "password" }.
 * A new password signs you out everywhere else; this browser gets a fresh session.
 */
export const PATCH = handle(async (req: Request) => {
  const caller = await requireUser(req);
  const b = await body<{ name?: string; currentPassword?: string; password?: string }>(req);
  if (b.password !== undefined) {
    const { user, sessionVersion } = await changeOwnPassword(caller.id, b.currentPassword, b.password);
    const { token, expires } = createSessionToken({ id: user.id, sessionVersion });
    (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "strict", secure: isHttps(req), path: BASE || "/", expires });
    return json({ user });
  }
  const { user } = await updateUser(caller.id, { name: b.name });
  return json({ user });
});
