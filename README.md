# Quill docs

A self-hosted documentation platform, themed to match InkBot: a public docs site, an admin portal to edit and customise it by hand (visual or Markdown editor, navigation, home page, logo, colours, API keys), and an API so bots can edit it too. Next.js 16, no database. Pages are Markdown files on disk.

## Install on a server

One command sets up Docker, Quill, HTTPS and your admin account on a Linux server (Ubuntu or Debian, or any Linux with Docker):

```bash
curl -fsSL https://raw.githubusercontent.com/IcyRelic/Quill/main/install.sh | sudo bash
```

It asks how people will reach Quill (your domain with automatic HTTPS, behind Cloudflare, behind a web server you already run, or the server's IP), then for your admin account. Afterwards, the `quill` command updates Quill, manages accounts and makes backups (`quill help`).

## Run it from the code

```bash
npm install
cp .env.example .env.local   # then set the session secret
npm run user -- add          # make the first admin account
npm run build
npm start                    # http://localhost:3000
```

For development, `npm run dev`.

| Variable | What it does |
| --- | --- |
| `QUILL_SESSION_SECRET` | 16+ random characters used to sign admin sessions. |
| `QUILL_API_KEYS` | Optional legacy API keys, comma-separated. Make keys in the admin portal under **API keys** instead; keys here keep working and show there read-only. |
| `QUILL_CONTENT_DIR` | Where content is stored. Default `./content`. |
| `QUILL_BASE_PATH` | Optional. Serve Quill under a sub-path such as `/docs` instead of the root of its domain. Set it when building, and again when starting with `npm start`. A Docker image keeps the value it was built with. |

### Docker

```bash
docker build -t quill-docs .
docker run -p 3000:3000 -v quill-data:/data \
  -e QUILL_SESSION_SECRET=... quill-docs
docker exec -it <container> node quill-user.mjs add   # make the first admin account
```

The first start copies the sample content into the `/data` volume. After that, the volume is the source of truth.

Hosting needs a writable, persistent disk (a VPS, Docker, Railway, Fly.io, Render with a disk). Serverless hosts with read-only file systems (plain Vercel or Netlify) will serve the site but can't save edits.

### Under a sub-path

To run Quill at an address like `https://example.org/docs`, next to another site at the root, build it with the sub-path:

```bash
QUILL_BASE_PATH=/docs npm run build && QUILL_BASE_PATH=/docs npm start   # Node
docker build --build-arg QUILL_BASE_PATH=/docs -t quill-docs .           # Docker
```

The sub-path is part of the build, so one build serves one path; rebuild to change it. Proxy `/docs` to Quill without stripping the prefix (and don't redirect `/docs` to `/docs/`: Quill redirects the other way), and set **Public address** under Site settings to the full address (`https://example.org/docs`). Content stays the same: links and uploads in pages are written relative to Quill (`/quickstart`, `/uploads/a.png`) and get the sub-path when shown.

## Where things are

```
content/site.json          name, top bar links, sidebar (groups and dropdowns), home page, footer, logo, favicon, theme colours
content/api-keys.json      API keys made in the portal (hashes only; keep it private)
content/users.json         admin portal accounts (password hashes; keep it private)
content/pages/**/*.md      one Markdown file per page (front matter: title, description, draft, updated)
content/uploads/           files uploaded in the admin portal or through the API
public/quill.svg           the default logo (public/icon.svg is the default browser tab icon)
app/globals.css            type and the default colours; lib/theme.ts lists the colours Appearance can change
components/Art.tsx         the line drawings used on the home page cards
app/(site)/                the public site      app/admin/   the admin portal
components/admin/editor/   the visual editor (TipTap) and its Markdown conversion
app/api/v1/                the API             lib/         storage, navigation, Markdown, search, auth
```

You can edit the files directly; changes show on the next page load.

## Accounts

Everyone signs in to `/admin` with their own account, stored (hashed) in `content/users.json`. **Admins** can do everything; **editors** can change pages, navigation, the home page and files. Admins add people under **Accounts**. On the server, `node scripts/quill-user.mjs` (`npm run user --`, or `quill user` after the installer) adds, lists and removes accounts and resets passwords.

## Sidebar dropdowns

In `site.json`, a group's `pages` lists slugs in order. An object in the list is a dropdown:

```json
{ "title": "Get started", "pages": ["introduction", { "title": "Deploy", "pages": ["deploy/docker", "deploy/server"] }] }
```

The Navigation screen in the admin portal builds these with **Add dropdown**. Through the API, send `group` and `folder` with a page, or `PUT /api/v1/navigation`.

## Writing pages

The page editor has a visual mode and a Markdown mode. Both save the same Markdown: the visual editor reads and writes it with the same parser the site renders with, and keeps anything it has no block for exactly as written.


Markdown plus callouts (`:::note`, `:::tip`, `:::warning`, `:::danger`), `:::steps`, `::::tabs` with `:::tab[Label]`, `:::accordion[Question]`, `:::links`, `:kbd[Ctrl]` and `::video{src="..."}`. The pages under **Components** in the sidebar show each one with its Markdown. To nest blocks, give the outer one more colons.

## For bots

- `/llms.txt` lists every page.
- `/api/v1/openapi.json` describes every endpoint.
- Writes need `Authorization: Bearer <key>`.

```bash
curl -X PUT https://docs.example.org/api/v1/pages/deploy/fly \
  -H "Authorization: Bearer $QUILL_API_KEY" -H "Content-Type: application/json" \
  -d '{"title":"Fly.io","description":"Deploy on Fly.io.","group":"Get started","folder":"Deploy","body":"..."}'
```

`PATCH` takes `appendBody` (add to the end) and `newSlug` (move the page). `PUT /api/v1/navigation` reorders the sidebar; `PATCH /api/v1/site` changes settings; `POST /api/v1/uploads` uploads a file.

## Sample content

The sample pages document Quill itself (setup, writing, components, admin portal, API) and match how this build works. Replace or extend them for your own apps. The `docs.example.org` addresses in examples are placeholders.
