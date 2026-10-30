import { handle, json, requireAdmin, body } from "@/lib/api";
import { createUser, listUsers } from "@/lib/users";

export const dynamic = "force-dynamic";

/** Every account. Admins only. */
export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  return json({ users: await listUsers() });
});

/** Adds an account. Body: { "username", "name", "password", "role": "admin" | "editor" }. Admins only. */
export const POST = handle(async (req: Request) => {
  await requireAdmin(req);
  const b = await body<{ username?: string; name?: string; password?: string; role?: string }>(req);
  return json({ user: await createUser({ username: b.username, name: b.name, password: b.password, role: b.role }) }, 201);
});
