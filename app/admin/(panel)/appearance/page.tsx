import { getSite } from "@/lib/content";
import AppearanceForm from "@/components/admin/AppearanceForm";
import { requireAdminScreen } from "@/lib/auth";

export default async function AppearanceScreen() {
  await requireAdminScreen();
  return <AppearanceForm initial={await getSite()} />;
}
