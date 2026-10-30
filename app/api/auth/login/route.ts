import { checkPassword, createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { BASE, stripBase } from "@/lib/basePath";
import { seeOther } from "@/lib/api";

export async function POST(req: Request) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const next = stripBase(String(form.get("next") ?? "/admin"));
  const target = next.startsWith("/admin") && !next.startsWith("/admin/login") ? next : "/admin";
  if (!checkPassword(password)) {
    // Slow down guessing a little.
    await new Promise((r) => setTimeout(r, 600));
    return seeOther(`/admin/login?error=1&next=${encodeURIComponent(target)}`);
  }
  const { token, expires } = createSessionToken();
  const res = seeOther(target);
  const https = (req.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? new URL(req.url).protocol.replace(":", "")) === "https";
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "strict", secure: https, path: BASE || "/", expires });
  return res;
}
