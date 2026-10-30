import { requireAdminScreen } from "@/lib/auth";
import { listUsers } from "@/lib/users";
import Users from "@/components/admin/Users";
import { ScreenHead } from "@/components/admin/useSiteDraft";

export const dynamic = "force-dynamic";

export default async function UsersScreen() {
  const me = await requireAdminScreen();
  return (
    <>
      <ScreenHead title="Accounts" sub="Who can sign in to the admin portal. Admins can do everything; editors can change pages, navigation, the home page and files." />
      <Users initial={await listUsers()} me={me.id} />
    </>
  );
}
