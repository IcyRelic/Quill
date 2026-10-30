"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UserInfo } from "@/lib/users";
import { adminFetch } from "./api";
import { Field, Section } from "./useSiteDraft";

export default function Account({ user }: { user: UserInfo }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const send = async (json: Record<string, string>, done: string) => {
    setError("");
    setStatus("");
    try {
      await adminFetch("/api/v1/account", { method: "PATCH", json });
      setStatus(done);
      router.refresh();
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
  };

  const saveName = (e: React.FormEvent) => {
    e.preventDefault();
    send({ name }, "Name saved.");
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      setError("The new passwords don’t match.");
      return;
    }
    if (await send({ currentPassword: current, password: next }, "Password changed. Other browsers signed in to this account have been signed out.")) {
      setCurrent("");
      setNext("");
      setConfirm("");
    }
  };

  return (
    <div className="a-settings">
      {error ? (
        <p className="a-error" role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="a-hint" role="status">
          {status}
        </p>
      ) : null}

      <Section title="Name" description={`You sign in as ${user.username}. Your name is shown as “Last edited by” on pages you change and on apps you approve.`}>
        <form onSubmit={saveName}>
          <Field id="me-name" label="Name">
            <div className="a-input-row">
              <input id="me-name" className="a-input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
              <button className="a-btn a-btn-primary" type="submit" disabled={!name.trim() || name.trim() === user.name}>
                Save
              </button>
            </div>
          </Field>
        </form>
      </Section>

      <Section title="Password" description="Changing it signs you out of every other browser.">
        <form onSubmit={savePassword}>
          <input type="text" name="username" autoComplete="username" value={user.username} readOnly hidden />
          <Field id="me-current" label="Current password">
            <input id="me-current" className="a-input" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
          <div className="a-two">
            <Field id="me-new" label="New password" hint="At least 8 characters.">
              <input id="me-new" className="a-input" type="password" autoComplete="new-password" required minLength={8} aria-describedby="me-new-hint" value={next} onChange={(e) => setNext(e.target.value)} />
            </Field>
            <Field id="me-confirm" label="New password again">
              <input id="me-confirm" className="a-input" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
          </div>
          <button className="a-btn a-btn-primary a-add" type="submit" disabled={!current || next.length < 8 || !confirm}>
            Change password
          </button>
        </form>
      </Section>
    </div>
  );
}
