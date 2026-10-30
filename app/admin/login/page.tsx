import { redirect } from "next/navigation";
import { getSessionUser, sessionsConfigured } from "@/lib/auth";
import { getSite } from "@/lib/content";
import { hasUsers } from "@/lib/users";
import { withBase } from "@/lib/basePath";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; username?: string }> }) {
  const { error, next, username } = await searchParams;
  if (await getSessionUser()) redirect(next?.startsWith("/admin") ? next : "/admin");
  const [site, accounts] = await Promise.all([getSite(), hasUsers()]);
  return (
    <div className="a-login">
      <div className="a-login-form">
        <a className="wordmark" href={withBase("/")}>
          <img src={withBase(site.logo)} alt="" width="28" height="28" />
          <span>{site.name}</span>
          {site.tagline ? <span className="wordmark-sub">{site.tagline}</span> : null}
        </a>
        <h1>Sign in to edit the docs</h1>
        {!sessionsConfigured() ? (
          <p className="a-error" role="alert">
            The admin portal is switched off. Set a QUILL_SESSION_SECRET of at least 16 characters in the server’s environment, then restart.
          </p>
        ) : !accounts ? (
          <div className="a-login-notice" role="status">
            <p>There are no accounts yet. Make the first one on the server:</p>
            <pre className="a-mono">quill user add</pre>
            <p>
              That’s for servers set up with the Quill installer. In Docker, run <code>docker compose exec &lt;service&gt; node quill-user.mjs add</code>; from a copy of the code, <code>npm run user -- add</code>.
            </p>
          </div>
        ) : (
          <form method="post" action={withBase("/api/auth/login")}>
            <input type="hidden" name="next" value={next ?? "/admin"} />
            <div className="a-field">
              <label htmlFor="username">Username</label>
              <input className="a-input" id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus={!username} defaultValue={username} />
            </div>
            <div className="a-field">
              <label htmlFor="password">Password</label>
              <input className="a-input" id="password" name="password" type="password" autoComplete="current-password" required autoFocus={!!username} aria-describedby={error ? "login-error" : undefined} />
            </div>
            {error ? (
              <p className="a-error" id="login-error" role="alert">
                That username and password don’t match an account.
              </p>
            ) : null}
            <button className="a-btn a-btn-primary" type="submit">
              Sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
