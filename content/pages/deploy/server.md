---
title: "Node server"
description: "Run Quill directly with Node on a server you manage."
updated: "2026-10-28T12:00:00.000Z"
---

Any server that can run Node.js 22 works: a VPS, a home server or a machine on your network.

:::steps
### Copy the project and build it

```bash
npm ci
npm run build
```

### Choose where content lives
Set `QUILL_CONTENT_DIR` to a folder outside the project if you want to upgrade the code without touching content.

```bash
QUILL_CONTENT_DIR=/srv/quill/content
```

### Start it and keep it running

```bash
PORT=3000 npm start
```

Use your usual process manager (systemd, pm2) so it restarts after a reboot, and put a reverse proxy such as Caddy or nginx in front for HTTPS.
:::

## Run it under a sub-path

To serve the docs at an address like `https://example.org/docs`, next to another site at the root, set `QUILL_BASE_PATH` when you build and when you start:

```bash
QUILL_BASE_PATH=/docs npm run build
QUILL_BASE_PATH=/docs npm start
```

Then send `/docs` to Quill in your reverse proxy **without** removing the prefix, and without redirecting `/docs` to `/docs/` (Quill redirects `/docs/` to `/docs` itself). For nginx:

```nginx
location /docs {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Set **Public address** under Site settings to the full address, such as `https://example.org/docs`, so links the API returns are right.

:::note
The sub-path is part of the build. To move Quill to a different path, or back to the root, build it again. Your content doesn't change: keep writing links as `/quickstart` and Quill adds the sub-path when it shows them.
:::
