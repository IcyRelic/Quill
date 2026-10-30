import { getSite } from "@/lib/content";
import SettingsForm from "@/components/admin/SettingsForm";
import { requireAdminScreen } from "@/lib/auth";

export default async function SettingsScreen() {
  await requireAdminScreen();
  return <SettingsForm initial={await getSite()} />;
}
