import { getSite } from "@/lib/content";
import AppearanceForm from "@/components/admin/AppearanceForm";

export default async function AppearanceScreen() {
  return <AppearanceForm initial={await getSite()} />;
}
