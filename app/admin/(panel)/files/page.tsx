import { listUploads } from "@/lib/content";
import Files from "@/components/admin/Files";

export default async function FilesScreen() {
  return <Files initial={await listUploads()} />;
}
