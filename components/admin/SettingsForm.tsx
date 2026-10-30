"use client";

import type { SiteConfig } from "@/lib/content";
import { Field, LinksEditor, SaveBar, ScreenHead, Section, useSiteDraft } from "./useSiteDraft";

export default function SettingsForm({ initial }: { initial: SiteConfig }) {
  const { site, set, dirty, saving, status, error, save } = useSiteDraft(initial, ["name", "tagline", "description", "links", "copyright", "footer", "adminName", "publicUrl"]);
  const year = String(new Date().getFullYear());

  return (
    <>
      <ScreenHead title="Site settings" sub="The name, top bar and footer readers see on every page. Changes are live when you save." />
      {error ? (
        <p className="a-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="a-settings">
        <Section title="Name" description="Shown beside the logo, in the browser tab and in llms.txt.">
          <div className="a-two">
            <Field id="s-name" label="Product name">
              <input id="s-name" className="a-input" value={site.name} onChange={(e) => set((s) => ({ ...s, name: e.target.value }))} />
            </Field>
            <Field id="s-tagline" label="Beside the name" hint="Optional, for example Docs.">
              <input id="s-tagline" className="a-input" aria-describedby="s-tagline-hint" value={site.tagline} onChange={(e) => set((s) => ({ ...s, tagline: e.target.value }))} />
            </Field>
          </div>
          <Field id="s-desc" label="Description" hint="Used by search engines and in llms.txt.">
            <textarea id="s-desc" className="a-textarea a-textarea-short" aria-describedby="s-desc-hint" value={site.description} onChange={(e) => set((s) => ({ ...s, description: e.target.value }))} />
          </Field>
        </Section>

        <Section title="Admin and links" description="Your name, as shown on pages you edit and apps you approve, and the address Quill puts in links it hands out.">
          <div className="a-two">
            <Field id="s-admin" label="Your name" hint="For example William. Shown as “Last edited by” and on connected apps.">
              <input id="s-admin" className="a-input" aria-describedby="s-admin-hint" value={site.adminName} onChange={(e) => set((s) => ({ ...s, adminName: e.target.value }))} />
            </Field>
            <Field id="s-url" label="Public address" hint="Optional, for example https://docs.example.org, including any sub-path such as /docs. Used in preview links and page links. Empty: the address the request came in on.">
              <input id="s-url" className="a-input" aria-describedby="s-url-hint" placeholder="https://docs.example.org" value={site.publicUrl} onChange={(e) => set((s) => ({ ...s, publicUrl: e.target.value.trim() }))} />
            </Field>
          </div>
        </Section>

        <Section title="Top bar" description="Up to five links next to the logo. The one that matches the reader’s page is highlighted; a link to / covers every page the others don’t.">
          <LinksEditor name="Top bar link" links={site.links} max={5} onChange={(links) => set((s) => ({ ...s, links }))} />
        </Section>

        <Section title="Footer" description="The line at the bottom of every page.">
          <Field id="s-copyright" label="Copyright line" hint={`{year} becomes the current year: “${site.copyright.replace("{year}", year)}”.`}>
            <input id="s-copyright" className="a-input" aria-describedby="s-copyright-hint" value={site.copyright} onChange={(e) => set((s) => ({ ...s, copyright: e.target.value }))} />
          </Field>
          <div className="a-field">
            <span className="a-label">Footer links</span>
            <LinksEditor name="Footer link" links={site.footer.links} onChange={(links) => set((s) => ({ ...s, footer: { ...s.footer, links } }))} />
          </div>
          <label className="a-check a-field">
            <input type="checkbox" checked={site.footer.poweredBy} onChange={(e) => set((s) => ({ ...s, footer: { ...s.footer, poweredBy: e.target.checked } }))} />
            Show “Powered by Quill”
          </label>
        </Section>
      </div>
      <SaveBar dirty={dirty} saving={saving} status={status} onSave={save} label="Save settings" />
    </>
  );
}
