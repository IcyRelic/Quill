# Quill API reference (for building an InkBot connector)

This file documents every HTTP endpoint in Quill, taken from the route code in `app/api/`. All examples assume Quill is running at `http://localhost:3210`. Use your real origin in production.

## Basics

| | |
|---|---|
| Base URL | `{origin}/api/v1` |
| Format | JSON in and out, except file uploads (multipart is allowed) and `/llms.txt` (plain text) |
| Caching | Every API response sends `cache-control: no-store` |
| Machine-readable spec | `GET /api/v1/openapi.json` (OpenAPI) |
| Page index for LLMs | `GET /llms.txt` |

### Authentication

Reads are public. Every write, plus listing uploads and previewing Markdown, needs an API key.

Send the key in either header:

```http
Authorization: Bearer <key>
x-api-key: <key>
```

- Keys are made in the admin portal under **API keys** (or with `/api/v1/keys`, below). Each bot or connector should have its own key. A key is shown once, when it is made; Quill stores only its SHA-256 hash. Revoking a key stops it at once. Keys made this way start with `quill_`.
- Keys in the server's `QUILL_API_KEYS` variable (comma-separated) still work as legacy keys. The portal lists them read-only; to revoke one, remove it from the variable and restart Quill.
- An app such as InkBot can instead **connect** (see "Connecting an app" below): an admin approves a code, the app gets its own token, and it makes a key for each of its bots. The app's token works anywhere a key does.
- With no keys of either kind, the API is read-only.
- A key also unlocks drafts: with a valid key, `GET /pages`, `GET /pages/{slug}` and `GET /navigation` include draft pages.
- Writes record who made them: the page's `updatedBy` is the key's name (or the app's name for its own token, `Legacy API key` for a key from `QUILL_API_KEYS`, or the signed-in account's name for portal edits).
- The admin portal uses a session cookie plus `x-quill-admin: 1`. A connector should always use a key instead.

### Errors

Every error is JSON with one readable message:

```json
{ "error": "No page at \"guides/missing\"." }
```

| Status | Meaning |
|---|---|
| `400` | Bad input: invalid JSON, a missing title, a bad slug, the wrong navigation shape, or a file type that isn't allowed |
| `401` | No key, or the key is wrong or revoked |
| `403` | The caller can't use this endpoint: a key on an admin-only endpoint (`/api/v1/keys`), or anything but a connected app's own token on `/api/v1/connection/keys` and `DELETE /api/connect`. While pairing, `403` from `POST /api/connect/poll` means the admin denied the request. |
| `410` | `POST /api/connect/poll` only: the pairing request expired, is unknown, or its token was already collected |
| `429` | `POST /api/connect/start` only: too many requests; wait a minute |
| `404` | Page or file not found. A draft read without a key also returns 404. |
| `409` | Slug already taken (`POST /pages`, or `PATCH` with `newSlug`) |
| `500` | Server error. Details go to the server log, not the response. |

The `error` text is written to be shown to a person or a bot as it is.

### Slugs

A slug is a page's address, without a leading slash: `quickstart`, `deploy/docker`, `guides/export-a-pdf`.

- Use lowercase letters, numbers and hyphens, with `/` between folders. The pattern is `^[a-z0-9]+(?:-[a-z0-9]+)*(?:/[a-z0-9]+(?:-[a-z0-9]+)*)*$`.
- A slug can't start with `admin`, `api`, `search`, `uploads`, `images`, `_next`, `llms.txt` or `favicon.ico`.
- `..`, uppercase letters, spaces and trailing slashes are all rejected.
- A page with slug `deploy/docker` is stored at `content/pages/deploy/docker.md` and served at `/deploy/docker`.

### The Page object

```json
{
  "slug": "deploy/docker",
  "title": "Docker",
  "description": "Run Quill in a container with a volume for content.",
  "draft": true,
  "updated": "2026-10-28T12:00:00.000Z",
  "updatedBy": "InkBot: Juniper",
  "url": "https://docs.example.org/deploy/docker",
  "previewUrl": "https://docs.example.org/preview/ggvYSA9VLAblVT7niF-qKoSm",
  "body": "Markdown body, without front matter..."
}
```

- `updated` is an ISO timestamp that Quill sets on every save.
- `updatedBy` is who saved it last: a key's name, a connected app's name, `Legacy API key`, or the account's name. `null` for pages saved before Quill recorded it.
- `url` is the page's address on the site. It is always there.
- `previewUrl` is a shareable link to a **draft**: anyone with it can read the page without signing in, with a "Draft preview" banner, and search engines are told not to index it. It's included whenever the page is a draft and the request has a key (or an admin session). The link stays the same when the page is saved or moved; `PATCH` with `resetPreview` makes a new one. Once the page is published the link redirects to `url`.
- Both addresses use the Public address from Site settings (`publicUrl`) if one is set, else the address the request came in on.
- Every page response includes them: `POST`, `PUT`, `PATCH`, `GET` one page, and `GET` the list (which leaves out `body`).

---

## Pages

### List pages

`GET /api/v1/pages` (public; include a key to see drafts)

```json
{ "pages": [ { "slug": "introduction", "title": "Introduction", "description": "...", "draft": false, "updated": "..." } ] }
```

Pages are sorted by slug, and `body` is left out.

### Read a page

`GET /api/v1/pages/{slug}` (public; a draft needs a key)

Query parameter:
- `html=1`: also returns `html` (the rendered body) and `toc` (the headings used for "On this page").

```bash
curl http://localhost:3210/api/v1/pages/deploy/docker?html=1
```

```json
{ "page": { "slug": "deploy/docker", "title": "...", "body": "...", "html": "<h2 id=\"...\">...</h2>", "toc": [ { "id": "...", "text": "...", "depth": 2 } ] } }
```

### Create a page (fails if it exists)

`POST /api/v1/pages` (key required)

| Field | Type | Required | Notes |
|---|---|---|---|
| `slug` | string | yes | See [Slugs](#slugs) |
| `title` | string | yes | Can't be blank |
| `description` | string | no | Shown under the title and in search |
| `body` | string | no | Markdown. See [Writing page bodies](#writing-page-bodies). |
| `draft` | boolean | no | `true` hides the page from the public site, search and `llms.txt` |
| `group` | string | no | Sidebar group to place the page in. Quill creates the group if it doesn't exist. |
| `folder` | string | no | Dropdown inside `group`. Created if missing. Ignored without `group`. |
| `position` | integer | no | Index inside the group or folder (0 = first). If omitted, the page goes at the end. |

```bash
curl -X POST http://localhost:3210/api/v1/pages \
  -H "Authorization: Bearer $QUILL_API_KEY" -H "Content-Type: application/json" \
  -d '{"slug":"guides/connect-a-bot","title":"Connect a bot","description":"Give a bot write access.","body":"## Steps\n\nCreate a key.","group":"Get started","folder":"Guides"}'
```

Returns `201 { "page": Page }`. If the slug is taken, it returns `409`.

### Create or replace a page

`PUT /api/v1/pages/{slug}` (key required)

The fields are the same as `POST`, without `slug`, which comes from the URL. Returns `201` if the page was created and `200` if it replaced one.

This is a full replace. Any field you leave out is reset:
- `description` becomes empty.
- `body` becomes empty.
- `draft` becomes `false`, which publishes the page.

To change only some fields, use `PATCH`. A connector that "syncs" pages should use `PUT`, because it's idempotent.

### Update part of a page

`PATCH /api/v1/pages/{slug}` (key required)

Fields you leave out stay the same.

| Field | Notes |
|---|---|
| `title`, `description`, `body`, `draft` | Replace that field |
| `appendBody` | Markdown added to the end of the body, after a blank line. It's applied after `body`, if you send both. |
| `newSlug` | Moves the page. Its place in the sidebar follows the move. Returns `409` if the new slug is taken. |
| `group`, `folder`, `position` | Move the page in the sidebar. This works the same way as in `POST`. |
| `resetPreview` | `true` makes a new preview link; the old `previewUrl` stops working. Sent on its own, it doesn't count as an edit (`updated` and `updatedBy` stay). |

```bash
# Add a section to the end of a changelog
curl -X PATCH http://localhost:3210/api/v1/pages/changelog \
  -H "Authorization: Bearer $QUILL_API_KEY" -H "Content-Type: application/json" \
  -d '{"appendBody":"## 2026-10-29\n\n- Added the InkBot connector."}'
```

Returns `200 { "page": Page }`, or `404` if there's no page at that slug.

### Delete a page

`DELETE /api/v1/pages/{slug}` (key required)

Deletes the Markdown file and removes the page from the sidebar. Returns `200 { "deleted": "guides/connect-a-bot" }`, or `404`. This can't be undone through the API.

---

## Navigation (sidebar)

The sidebar is a list of **groups**. Each group lists **entries** in order. An entry is either a page slug or a **dropdown** (`{ title, pages: [slug, ...] }`). Dropdowns can't be nested.

### Read the sidebar

`GET /api/v1/navigation` (public; include a key to see drafts)

```json
{
  "navigation": [
    { "title": "Get started", "pages": ["introduction", "quickstart", { "title": "Deploy", "pages": ["deploy/docker", "deploy/server"] }] }
  ],
  "resolved": [
    {
      "title": "Get started",
      "items":   [ { "slug": "introduction", "title": "Introduction", "draft": false }, ... ],
      "entries": [ { "slug": "introduction", "title": "Introduction", "draft": false }, { "title": "Deploy", "items": [ ... ] } ]
    }
  ]
}
```

- `navigation` is the raw stored shape. Send this shape back to `PUT`.
- `resolved` adds page titles. It drops slugs whose page no longer exists, and hides drafts unless you sent a key.
  - `items` is every page in reading order, with dropdowns flattened. Quill uses this order for the previous and next links.
  - `entries` keeps the dropdowns.

### Replace the sidebar

`PUT /api/v1/navigation` (key required)

```json
{
  "navigation": [
    { "title": "Get started", "pages": ["introduction", { "title": "Deploy", "pages": ["deploy/docker"] }] },
    { "title": "Help", "pages": ["help/faq"] }
  ]
}
```

- A slug that appears more than once keeps only its first place. Titles are trimmed.
- Slugs aren't checked against existing pages. A missing page is simply not shown.
- A page that's left out of the sidebar still exists and can still be opened by its URL.
- A badly shaped body returns `400`.

Returns `200 { "navigation": [...] }` with the cleaned value.

To move a single page, it's simpler to `PATCH /pages/{slug}` with `group`, `folder` and `position`.

---

## Site settings

### Read settings

`GET /api/v1/site` (public)

```json
{
  "site": {
    "name": "Quill",
    "tagline": "Docs",
    "description": "Used in <meta> and llms.txt",
    "links": [ { "label": "Documentation", "href": "/" } ],
    "navigation": [ ... ],
    "home": {
      "title": "Documentation",
      "lead": "Text under the home heading",
      "cards": [ { "title": "Quickstart", "description": "...", "href": "/quickstart", "icon": "quill", "image": "/uploads/optional.png" } ]
    },
      "showArt": true
    },
    "copyright": "© {year} Quill",
    "footer": { "links": [ { "label": "Status", "href": "https://status.example.org" } ], "poweredBy": true },
    "logo": "/quill.svg",
    "favicon": "/icon.svg",
    "theme": { "colors": { "accent": "#22c55e" } },
    "adminName": "William",
    "publicUrl": "https://docs.example.org"
  }
}
```

- `links` are the top-bar links beside the logo.
- In `copyright`, `{year}` is replaced with the current year.
- A card's `icon` is one of `quill`, `blocks`, `editor`, `terminal`, `server` or `bot`. If `image` is set, it replaces the drawing.
- `home.showArt` shows the faint drawing behind the home heading.
- `footer.links` are links on the footer line; `footer.poweredBy` shows the "Powered by Quill" credit.
- `logo` is the image beside the name (top bar, admin portal, sign-in); `favicon` is the browser tab icon. Both are addresses, usually `/uploads/...`.
- `theme.colors` holds only the colours changed from Quill's defaults, as hex values. Leave a colour out (or send its default) to use the default; `{ "colors": {} }` resets them all. The names are `accent`, `accent-strong`, `accent-pale`, `accent-deep`, `accent-ink`, `ground`, `panel`, `raised`, `hover`, `art-ground`, `line`, `line-strong`, `ink`, `ink-soft`, `ink-faint`, `note`, `warn` and `danger`. Tints for highlights and borders follow the colour they come from.
- `home.columns` is how many cards sit in a row on wide screens: 1, 2 (the default), 3 or 4.
- `adminName` is no longer used: each account has its own name, shown as `updatedBy` and on app approvals.
- `publicUrl` is the site's public address, used in `url`, `previewUrl` and `verify_url`. Empty (the default) means the address each request came in on.
- Sites saved before these settings existed get the defaults shown here, so every response has the full shape.

### Change some settings

`PATCH /api/v1/site` (key required)

Top-level keys are merged into the settings. Objects such as `home`, `footer` and `theme` are merged one level deep. Arrays such as `links`, `navigation`, `home.cards` and `footer.links` are replaced whole, and so is `theme.colors`.

```bash
curl -X PATCH http://localhost:3210/api/v1/site \
  -H "Authorization: Bearer $QUILL_API_KEY" -H "Content-Type: application/json" \
  -d '{"home":{"lead":"Docs for the InkBot team."}}'
```

```bash
curl -X PATCH http://localhost:3210/api/v1/site \
  -H "Authorization: Bearer $QUILL_API_KEY" -H "Content-Type: application/json" \
  -d '{"theme":{"colors":{"accent":"#22c55e"}}}'
```

If you send `navigation`, it's checked the same way as in `PUT /navigation`. A wrong shape, an unknown colour name or a colour that isn't hex returns `400` naming the field. Returns `200 { "site": ... }`.

### Replace all settings

`PUT /api/v1/site` (key required)

You must send the full object, with at least `name`, `navigation` and `home`, or it returns `400`. Settings you leave out go back to their defaults (for example, no `theme` means the default colours). Prefer `PATCH`.

---

## Search

`GET /api/v1/search?q={query}` (public; published pages only)

```json
{
  "query": "docker volume",
  "results": [
    { "slug": "deploy/docker", "title": "Docker", "description": "...", "group": "Get started", "excerpt": "…mount a volume at /app/content…", "score": 58 }
  ]
}
```

- Returns at most 12 results, best match first.
- Search terms of one character are ignored, except digits.
- An empty query returns `[]`.
- Search runs on every request, so new or edited pages show up right away.

---

## Preview Markdown

`POST /api/v1/preview` (key required)

Renders Markdown without saving it. It's useful for checking a body before you write it.

```json
{ "body": "## Hello\n\n:::tip\nA tip.\n:::" }
```

Returns `200 { "html": "...", "toc": [ ... ] }`.

---

## Files (uploads)

### List files

`GET /api/v1/uploads` (key required)

```json
{ "uploads": [ { "name": "settings-sync.png", "url": "/uploads/settings-sync.png", "size": 48213, "updated": "..." } ] }
```

Newest first.

### Upload a file

`POST /api/v1/uploads` (key required)

You can send the file in either of two ways.

**Multipart** (field name `file`):

```bash
curl -X POST http://localhost:3210/api/v1/uploads \
  -H "Authorization: Bearer $QUILL_API_KEY" -F "file=@screen.png"
```

**JSON with base64** (easier from a bot). A `data:...;base64,` prefix is accepted:

```json
{ "name": "screen.png", "data": "iVBORw0KGgo..." }
```

Returns `201 { "upload": { "name": "screen.png", "url": "/uploads/screen.png", "size": 48213 } }`. Use the returned `url` in Markdown.

- Allowed types: `.png .jpg .jpeg .gif .webp .avif .svg .mp4 .webm .pdf`, up to 15 MB.
- Names are lowercased and turned into slugs (`My Screen.PNG` becomes `my-screen.png`).
- If the name is taken, Quill adds `-2`, `-3` and so on, so always use the returned `name` and `url`, not the name you sent.
- Files are served publicly at `/uploads/{name}`. SVGs are served sandboxed.

### Delete a file

`DELETE /api/v1/uploads/{name}` (key required)

Returns `200 { "deleted": "screen.png" }`, or `404`. Pages that still link to the file aren't changed.

---

## API keys (admin portal only)

These endpoints manage keys. They need a signed-in admin (the portal's session cookie plus `x-quill-admin: 1`). An API key gets `403`, so a leaked key can't make more keys or keep itself alive. Connectors don't need them; they're listed so the portal's behaviour is documented.

The key object never contains the key or its hash:

```json
{ "id": "b2568ee2aca0", "name": "InkBot: Juniper", "last4": "NWUM", "createdAt": "2026-10-30T00:28:34.609Z", "lastUsedAt": "2026-10-30T00:28:37.039Z", "legacy": false }
```

`lastUsedAt` is updated at most once a minute. Legacy keys from `QUILL_API_KEYS` have `"legacy": true`, ids `env-1`, `env-2` ... and no dates. `appId` is the connected app that issued the key, or `null` for portal and legacy keys.

| Call | Does | Returns |
|---|---|---|
| `GET /api/v1/keys` | List keys, newest first, then legacy keys; and the connected apps | `200 { "keys": [...], "apps": [...] }` |
| `POST /api/v1/keys` with `{ "name": "..." }` | Make a key | `201 { "key": {...}, "secret": "quill_..." }`. `secret` is the only time the key is shown. |
| `PATCH /api/v1/keys/{id}` with `{ "name": "..." }` | Rename a key | `200 { "key": {...} }` |
| `DELETE /api/v1/keys/{id}` | Revoke a key (including one an app issued); it stops working at once | `200 { "revoked": "id" }` |
| `DELETE /api/v1/connections/{id}` | Disconnect an app: its token and every key it issued stop working | `200 { "disconnected": "id" }` |
| `POST /api/connect/decide` with `{ "code": "ABCD-2345", "approve": true }` | The approval screen's Approve (`true`) or Deny (`false`) | `200 { "status": "approved" \| "denied" }`; `410` if the code expired; `409` if already decided |

Legacy keys can't be renamed or revoked here (`404` with an explanation). A name is required (up to 80 characters).

An app object: `{ "id": "8d484d1c201f", "name": "InkBot on DESKTOP-X", "last4": "ZWLk", "approvedBy": "William", "createdAt": "...", "lastUsedAt": "..." }`.

---

## Accounts (admin portal only)

The admin portal's sign-ins. Each call needs a signed-in session (the portal's cookie plus `x-quill-admin: 1`); API keys get `403`. Managing accounts needs an admin; `/api/v1/account` works for anyone signed in.

| Call | Does | Returns |
|---|---|---|
| `GET /api/v1/users` | Every account, oldest first | `200 { "users": [...] }` |
| `POST /api/v1/users` with `{ "username", "name", "password", "role" }` | Add an account. `role` is `admin` or `editor` | `201 { "user": {...} }`; `409` if the username is taken |
| `PATCH /api/v1/users/{id}` with any of `{ "name", "role", "password" }` | Change an account. A new password signs it out everywhere | `200 { "user": {...} }` |
| `DELETE /api/v1/users/{id}` | Remove an account; it is signed out at once. Not your own | `200 { "ok": true }` |
| `GET /api/v1/account` | The signed-in account | `200 { "user": {...} }` |
| `PATCH /api/v1/account` with `{ "name" }` or `{ "currentPassword", "password" }` | Change your name or password | `200 { "user": {...} }` |

A user object: `{ "id": "3f9a1c2b7d4e", "username": "william", "name": "William", "role": "admin", "createdAt": "...", "lastSignInAt": "..." }`. Passwords are stored as scrypt hashes and never returned. Usernames are 2 to 32 characters (letters, numbers, `.`, `-`, `_`) and are stored in lower case; passwords need at least 8 characters. The last admin can't be removed or made an editor (`409`).

Editors can change pages, navigation, the home page and files. On `/api/v1/site` they may send only `home` and `navigation` (`403` otherwise), and they get `403` on keys, connections and accounts.

---

## Connecting an app

An app (InkBot, for example) pairs with Quill without anyone copying a key, the way Blotter does. Start and poll need no key.

1. **Start.** `POST /api/connect/start` with `{ "client_name": "InkBot on DESKTOP-X" }` returns

   ```json
   { "code": "ABCD-2345", "secret": "<random>", "verify_url": "https://docs.example.org/admin/connect?code=ABCD-2345", "expires_in": 900, "interval": 3 }
   ```

   Show the code and open (or show) `verify_url`. Codes are four letters, a dash and four digits, without the easily confused `I`, `O`, `0` and `1`. Keep `secret` private. A start is limited to 10 a minute from one address (`429` beyond that).
2. **Approve.** An admin opens `verify_url` (after signing in, they come back to it), checks the code matches, and chooses **Approve** or **Deny**.
3. **Poll.** Every `interval` seconds, `POST /api/connect/poll` with `{ "code": "ABCD-2345", "secret": "<random>" }`:

   | Status | Body | Meaning |
   |---|---|---|
   | `202` | `{ "status": "pending" }` | Not decided yet; poll again |
   | `200` | `{ "token": "quill_...", "site": { "name": "Quill" }, "user": { "name": "William" } }` | Approved. `user` is the admin who approved. The token is returned this once. |
   | `403` | `{ "error": "..." }` | Denied |
   | `410` | `{ "error": "..." }` | Expired (after `expires_in`), unknown, wrong secret, or the token was already collected. Start again. |

   Pending requests are kept in memory: if Quill restarts during pairing, polls get `410` and the app starts again.

The token belongs to a **connected app**. It works anywhere a key does (read drafts, write pages, navigation, settings, uploads, preview), and pages it writes get the app's name as `updatedBy`. It can also make keys for the app's bots (below). It can't use the admin-only `/api/v1/keys`.

**Disconnect.** `DELETE /api/connect` with the app's token (`Authorization: Bearer <token>`) disconnects the app and revokes every key it issued. Returns `200 { "disconnected": true }`. The admin can do the same under API keys.

### Keys issued by a connected app

Only the app's own token may call these; a key (even one the app issued), a portal key or an admin session gets `403`. An app sees and changes only its own keys. The key object is the one above, with `appId` set.

| Call | Does | Returns |
|---|---|---|
| `GET /api/v1/connection/keys` | This app's keys | `200 { "keys": [...] }` |
| `POST /api/v1/connection/keys` with `{ "name": "InkBot: Juniper" }` | Issue a key | `201 { "key": {...}, "secret": "quill_..." }`. `secret` is the only time it is shown. |
| `PATCH /api/v1/connection/keys/{id}` with `{ "name": "..." }` | Rename one | `200 { "key": {...} }` |
| `DELETE /api/v1/connection/keys/{id}` | Revoke one | `200 { "revoked": "id" }` |

Issued keys are ordinary content keys: pages they write get the key's name as `updatedBy`, and they can't manage keys or connections. They are listed under the app in the admin portal, where each can be revoked.

---

## Discovery endpoints

| Endpoint | Returns |
|---|---|
| `GET /api/v1/openapi.json` | OpenAPI description of the endpoints above |
| `GET /llms.txt` | Plain text: site name and description, then each sidebar group with `[Title](origin/api/v1/pages/slug): description` lines. Published pages only. |

Draft preview pages are served at `/preview/{token}` (see `previewUrl` on the Page object). They are web pages, not API endpoints.

`/llms.txt` is the cheapest way for a bot to learn what pages exist before it reads or edits them.

---

## Writing page bodies

The body is GitHub-flavoured Markdown (tables, task lists, strikethrough) plus these blocks:

- **Front matter:** don't include it. Quill writes the front matter from the fields you send.
- **Headings:** don't start with an `#` heading. The page title is already shown as the `h1`. Use `##` and `###`, which build the "On this page" list.

````markdown
:::note
Plain note. Also :::tip, :::warning, :::danger.
:::

:::warning[Custom title]
Callout with its own title.
:::

:::steps
### First step
Text.

### Second step
Text.
:::

::::tabs
:::tab[Mac]
Mac instructions.
:::
:::tab[Windows]
Windows instructions.
:::
::::

:::accordion[Question as the title?]
Answer.
:::

:::links
- [Page title](/some/slug): one-line reason to go there.
:::

Press :kbd[Ctrl] + :kbd[K] to search.

![Alt text describing the picture](/uploads/screen.png)

::video{src="/uploads/walkthrough.mp4"}

```bash
code blocks are highlighted by language
```
````

- To put one block inside another, give the outer block one more colon (`::::tabs` around `:::tab`).
- Link to other pages with root paths such as `/deploy/docker`.

---

## Connector recipes

**Suggested tools for an InkBot connector**

| Tool | Call |
|---|---|
| `quill_list_pages` | `GET /pages` (or `GET /llms.txt` for a compact list) |
| `quill_read_page(slug)` | `GET /pages/{slug}` |
| `quill_search(q)` | `GET /search?q=` |
| `quill_create_page(slug, title, body, description?, group?, folder?, draft?)` | `POST /pages` |
| `quill_update_page(slug, fields)` | `PATCH /pages/{slug}` |
| `quill_append_to_page(slug, markdown)` | `PATCH /pages/{slug}` with `appendBody` |
| `quill_move_page(slug, newSlug?, group?, folder?, position?)` | `PATCH /pages/{slug}` |
| `quill_delete_page(slug)` | `DELETE /pages/{slug}`. Have the user confirm this first. |
| `quill_get_navigation` / `quill_set_navigation` | `GET` / `PUT /navigation` |
| `quill_upload_file(name, base64)` | `POST /uploads` (JSON) |
| `quill_preview(markdown)` | `POST /preview` |

**Connector settings to store:** the base URL (for example `https://docs.example.com`) and the API key. Store the key as a secret and send it on every request. It's harmless on reads, and it's what lets the connector see drafts.

**Safe edit flow for a bot**
1. Search with `GET /search?q=...`, or read `/llms.txt`, to find out whether a page already exists.
2. Read the current body with `GET /pages/{slug}`.
3. Write the change:
   - For small additions, use `PATCH` with `appendBody`.
   - For rewrites, use `PATCH` with `body`.
   - Use `PUT` only when you're sending every field.
4. For a new page:
   - `POST` with `draft: true` and a `group`.
   - Let the user review it at `/{slug}` while signed in to the admin portal.
   - Publish it with `PATCH { "draft": false }`.

**Gotchas**
- `PUT /pages/{slug}` without `draft` publishes the page, and without `description` it clears the description.
- `folder` does nothing unless you also send `group`.
- Group and folder names are matched exactly, including case. `"get started"` creates a new group next to `"Get started"`.
- Pages are files on disk, and the last write wins. There's no version check, so read just before you write.
- Changes show up on the public site straight away. Quill refreshes its cache after every write.
- Quill needs a writable disk. On read-only hosts (plain Vercel or Netlify), writes fail with `500`.
