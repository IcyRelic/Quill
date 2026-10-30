import { getPending, normalizeCode } from "@/lib/connect";
import { requireAdminScreen } from "@/lib/auth";
import ConnectApproval from "@/components/admin/ConnectApproval";

export const dynamic = "force-dynamic";

/** Where an app's verify_url lands: the admin compares the code and approves or denies the app. */
export default async function ConnectScreen({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const user = await requireAdminScreen();
  const code = normalizeCode((await searchParams).code);
  const pending = code ? getPending(code) : null;
  return (
    <>
      <div className="a-head">
        <div>
          <h1>Connect an app</h1>
          <p className="a-sub">An app asked to connect to these docs. Check the code matches the one the app shows, then approve it.</p>
        </div>
      </div>
      <ConnectApproval code={code} pending={pending} approver={user.name} />
    </>
  );
}
