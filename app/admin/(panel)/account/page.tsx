import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import Account from "@/components/admin/Account";
import { ScreenHead } from "@/components/admin/useSiteDraft";

export const dynamic = "force-dynamic";

export default async function AccountScreen() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  return (
    <>
      <ScreenHead title="Your account" sub={`Signed in as ${user.username}, ${user.role === "admin" ? "an admin" : "an editor"}.`} />
      <Account user={user} />
    </>
  );
}
