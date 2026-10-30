---
title: "Common questions"
description: "Short answers about running and editing Quill."
updated: "2026-10-28T12:00:00.000Z"
---

:::accordion[Does Quill need a database?]
No. Pages are Markdown files and settings are one JSON file, all inside the `content` folder.
:::

:::accordion[Can I edit the files directly?]
Yes. Changes show on the next page load. The admin portal and the API write the same files.
:::

:::accordion[How do I back up the site?]
Copy the `content` folder. It holds every page, setting and upload.
:::

:::accordion[Can more than one person edit?]
Yes. Each person has their own account, as an admin or an editor. See [Accounts](/admin-portal/accounts). If two people save the same page, the last save wins.
:::

:::accordion[Can I change the logo and colours?]
Replace `public/quill.svg` with your own logo. Colours are set at the top of `app/globals.css`.
:::

:::accordion[Is search sent to an outside service?]
No. Search runs inside Quill, over your own pages.
:::
