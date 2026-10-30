---
title: "Introduction"
description: "What Quill is, what it is made of, and where to go next."
updated: "2026-10-28T12:00:00.000Z"
---

Quill is a documentation site you host yourself. It gives your app a place for getting-started guides, how-to pages and answers to common questions, and it ships with an admin portal for editing by hand and an API that bots can use to keep the docs up to date.

## What you get

- **A public docs site.** A sidebar with groups and dropdowns, an "On this page" list, search with :kbd[Ctrl] :kbd[K], and previous and next links at the end of every page.
- **An admin portal** at `/admin`. Write pages with a live preview, arrange the sidebar, upload files and change the site settings.
- **A content API** at `/api/v1`. Create, update, move and delete pages, change the navigation, search and upload files. Bots in InkBot can use it with an API key.
- **Plain files.** Every page is a Markdown file in `content/pages`. There is no database to run or back up beyond that folder.

:::tip
New here? Follow the [Quickstart](/quickstart). It takes about five minutes and ends with your first page live.
:::

## How a page is made

A page is a Markdown file with a short header for its title and description. Ordinary Markdown covers most writing, and a few extra blocks add callouts, numbered steps, tabs and questions and answers.

```markdown
---
title: Connect your account
description: Link your account in three steps.
---

:::steps
### Open Settings
Choose **Settings** in the sidebar.
:::
```

## Where to go next

:::links
- [Quickstart](/quickstart): run Quill locally and publish a page.
- [Components](/components/overview): every block you can use in a page.
- [Admin portal](/admin-portal/overview): edit pages without touching files.
- [API reference](/api-reference/overview): let bots read and write the docs.
:::
