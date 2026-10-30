import { createSessionToken, sessionsConfigured, SESSION_COOKIE } from "@/lib/auth";
import { BASE, stripBase } from "@/lib/basePath";
import { isHttps, seeOther } from "@/lib/api";
import { signIn } from "@/lib/users";

export async function POST(req: Request) {
  const form = await req.formData();
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  const next = stripBase(String(form.get("next") ?? "/admin"));
  const target = next.startsWith("/admin") && !next.startsWith("/admin/login") ? next : "/admin";
  const user = sessionsConfigured() ? await signIn(username, password) : null;
  if (!user) {
    // Slow down guessing a little.
    await new Promise((r) => setTimeout(r, 600));
    return seeOther(`/admin/login?error=1&next=${encodeURIComponent(target)}&username=${encodeURIComponent(username.trim())}`);
  }
  const { token, expires } = createSessionToken(user);
  const res = seeOther(target);
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "strict", secure: isHttps(req), path: BASE || "/", expires });
  return res;
}
