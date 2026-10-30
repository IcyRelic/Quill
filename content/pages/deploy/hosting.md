---
title: "Choosing a host"
description: "Which hosts can save edits, and which can only serve the site."
updated: "2026-10-28T12:00:00.000Z"
---

Quill saves edits to disk, so it needs a host with a disk that is writable and persistent.

| Host | Serves the site | Saves edits |
| --- | --- | --- |
| A VPS or your own server | Yes | Yes |
| Docker with a volume | Yes | Yes |
| Railway, Fly.io, Render with a disk | Yes | Yes |
| Vercel, Netlify (no disk) | Yes | No |

:::tip
On a host without a disk you can still edit locally, commit the `content` folder and deploy it. The admin portal and API will read but not save.
:::
