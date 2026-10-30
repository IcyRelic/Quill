import { listApps, listKeys } from "@/lib/keys";
import ApiKeys from "@/components/admin/ApiKeys";
import { requireAdminScreen } from "@/lib/auth";

export default async function ApiScreen() {
  await requireAdminScreen();
  const [keys, apps] = await Promise.all([listKeys(), listApps()]);
  return (
    <>
      <div className="a-head">
        <div>
          <h1>API keys</h1>
          <p className="a-sub">Keys let bots and scripts read drafts and edit the docs. Every change is live as soon as the call returns.</p>
        </div>
      </div>
      <ApiKeys initial={keys} initialApps={apps} />
    </>
  );
}
