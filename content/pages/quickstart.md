---
title: "Quickstart"
description: "Run Quill on your computer and publish your first page in about five minutes."
updated: "2026-10-29T12:00:00.000Z"
---

You need Node.js 22 or later. Everything else comes from the project itself.

:::steps
### Install the project
Open a terminal in the Quill folder and install its packages.

```bash
npm install
```

### Set the three secrets
Copy the example settings file, then open `.env.local` and replace each value.

```bash
cp .env.example .env.local
```

| Setting | What it is for |
| --- | --- |
| `QUILL_ADMIN_PASSWORD` | The password for the admin portal. |
| `QUILL_SESSION_SECRET` | At least 16 random characters. Signs admin sessions. |
| `QUILL_API_KEYS` | Optional. Keys for bots, separated by commas. Usually you make keys in the admin portal instead. |

### Start the site
Build it once, then start it.

```bash
npm run build
npm start
```

Open `http://localhost:3000`. While you work on the theme itself, `npm run dev` reloads on every change.

### Write your first page
Go to `/admin`, sign in with your password and choose **New page**. Give it a title, pick a sidebar group and choose **Save**. The page is live straight away.
:::

:::note
Pages, settings and uploads are kept in the `content` folder. Copy that folder to back up the whole site.
:::

## Next steps

:::links
- [Deploy with Docker](/deploy/docker): put the site on a server.
- [Create a page](/pages/create-a-page): titles, addresses and drafts.
- [Connect InkBot](/inkbot): let your bots keep the docs current.
:::
