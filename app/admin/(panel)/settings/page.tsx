import { getSite } from "@/lib/content";
import SettingsForm from "@/components/admin/SettingsForm";

export default async function SettingsScreen() {
  return <SettingsForm initial={await getSite()} />;
}
