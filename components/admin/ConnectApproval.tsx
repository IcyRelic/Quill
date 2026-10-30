"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { withBase } from "@/lib/basePath";
import { adminFetch } from "./api";

type Pending = { code: string; clientName: string; status: "pending" | "approved" | "denied"; expiresAt: number; approvedBy: string | null } | null;

export default function ConnectApproval({ code, pending, approver }: { code: string; pending: Pending; approver: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(pending?.status ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [typed, setTyped] = useState(code);

  const decide = async (approve: boolean) => {
    setError("");
    setBusy(true);
    try {
      const r = await adminFetch<{ status: "approved" | "denied" }>("/api/connect/decide", { method: "POST", json: { code: pending!.code, approve } });
      setStatus(r.status);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!pending) {
    return (
      <form className="a-panel a-connect" onSubmit={(e) => (e.preventDefault(), router.push(`/admin/connect?code=${encodeURIComponent(typed.trim().toUpperCase())}`))}>
        {code ? <p className="a-error">No request with the code {code} is waiting. It may have expired (codes last 15 minutes); ask the app to start connecting again.</p> : null}
        <div className="a-field">
          <label htmlFor="cx-code">Code shown by the app</label>
          <div className="a-input-row">
            <input id="cx-code" className="a-input a-mono" placeholder="ABCD-2345" value={typed} onChange={(e) => setTyped(e.target.value)} />
            <button className="a-btn a-btn-primary" type="submit" disabled={!typed.trim()}>
              Find request
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <div className="a-panel a-connect">
      <p className="a-connect-app">
        <strong>{pending.clientName}</strong> wants to connect.
      </p>
      <p className="a-connect-code" aria-label={`Code ${pending.code.split("").join(" ")}`}>
        {pending.code}
      </p>
      {status === "pending" ? (
        <>
          <p className="a-hint">
            Approve only if the app shows this same code. It will be able to read drafts, change pages, navigation, settings and files, and make keys for its bots. You can disconnect it at any time under API keys. Approved as {approver}.
          </p>
          {error ? (
            <p className="a-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="a-connect-actions">
            <button className="a-btn a-btn-primary" type="button" disabled={busy} onClick={() => decide(true)}>
              Approve
            </button>
            <button className="a-btn a-btn-danger" type="button" disabled={busy} onClick={() => decide(false)}>
              Deny
            </button>
          </div>
        </>
      ) : status === "approved" ? (
        <p className="a-notice" role="status">
          Approved. {pending.clientName} is connected and appears under <a href={withBase("/admin/api")}>API keys</a>. You can close this tab.
        </p>
      ) : (
        <p className="a-error" role="status">
          Denied. The app was told it can’t connect.
        </p>
      )}
    </div>
  );
}
