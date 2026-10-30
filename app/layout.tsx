import type { Metadata, Viewport } from "next";
import { getSite } from "@/lib/content";
import { resolveColors, themeCss } from "@/lib/theme";
import { withBase } from "@/lib/basePath";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  return {
    title: { default: `${site.name} ${site.tagline}`.trim(), template: `%s · ${`${site.name} ${site.tagline}`.trim()}` },
    description: site.description,
    icons: { icon: withBase(site.favicon) },
  };
}

export async function generateViewport(): Promise<Viewport> {
  return { themeColor: resolveColors((await getSite()).theme).ground };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const css = themeCss((await getSite()).theme);
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Marks the page as scripted before paint, so hidden-until-revealed styles never hide content without JS. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
        {/* Colours changed under Appearance in the admin portal. */}
        {css ? <style id="quill-theme" dangerouslySetInnerHTML={{ __html: css }} /> : null}
      </head>
      <body>{children}</body>
    </html>
  );
}
