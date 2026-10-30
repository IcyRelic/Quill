import { redirect } from "next/navigation";
import { adminConfigured, isAdmin } from "@/lib/auth";
import { getSite } from "@/lib/content";
import { withBase } from "@/lib/basePath";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  if (await isAdmin()) redirect(next?.startsWith("/admin") ? next : "/admin");
  const site = await getSite();
  return (
    <div className="a-login">
      <div className="a-login-form">
        <a className="wordmark" href={withBase("/")}>
          <img src={withBase(site.logo)} alt="" width="28" height="28" />
          <span>{site.name}</span>
          {site.tagline ? <span className="wordmark-sub">{site.tagline}</span> : null}
        </a>
        <h1>Sign in to edit the docs</h1>
        {adminConfigured() ? (
          <form method="post" action={withBase("/api/auth/login")}>
            <input type="hidden" name="next" value={next ?? "/admin"} />
            <div className="a-field">
              <label htmlFor="password">Admin password</label>
              <input className="a-input" id="password" name="password" type="password" autoComplete="current-password" required autoFocus aria-describedby={error ? "login-error" : undefined} />
            </div>
            {error ? (
              <p className="a-error" id="login-error" role="alert">
                That password isn’t right.
              </p>
            ) : null}
            <button className="a-btn a-btn-primary" type="submit">
              Sign in
            </button>
          </form>
        ) : (
          <p className="a-error" role="alert">
            The admin portal is switched off. Set QUILL_ADMIN_PASSWORD and a QUILL_SESSION_SECRET of at least 16 characters in the server’s environment, then restart.
          </p>
        )}
      </div>
    </div>
  );
}
