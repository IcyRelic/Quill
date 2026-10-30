import { SESSION_COOKIE } from "@/lib/auth";
import { BASE } from "@/lib/basePath";
import { seeOther } from "@/lib/api";

export async function POST() {
  const res = seeOther("/admin/login");
  res.cookies.delete({ name: SESSION_COOKIE, path: BASE || "/" });
  return res;
}
