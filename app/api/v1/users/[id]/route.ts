import { handle, json, requireAdmin, body } from "@/lib/api";
import { deleteUser, updateUser } from "@/lib/users";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Changes an account's name, role or password. Body: any of { "name", "role", "password" }. Admins only. */
export const PATCH = handle(async (req: Request, { params }: Params) => {
  await requireAdmin(req);
  const b = await body<{ name?: string; role?: string; password?: string }>(req);
  const { user } = await updateUser((await params).id, { name: b.name, role: b.role, password: b.password });
  return json({ user });
});

/** Removes an account. It is signed out at once. Admins only, and not their own. */
export const DELETE = handle(async (req: Request, { params }: Params) => {
  const caller = await requireAdmin(req);
  await deleteUser((await params).id, caller.id);
  return json({ ok: true });
});
