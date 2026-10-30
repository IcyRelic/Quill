---
title: "Create a page"
description: "Titles, addresses, descriptions and drafts."
updated: "2026-10-28T12:00:00.000Z"
---

Every page has a title, an address and an optional description. You can create one in the admin portal, through the API, or by adding a Markdown file to `content/pages`.

## In the admin portal

:::steps
### Choose New page
On the **Pages** screen, choose **New page**.

### Fill in the header
The **Title** becomes the page heading and the browser tab. The **Address** is filled in from the title; change it if you like. The **Description** appears under the heading and in search results.

### Pick a sidebar group
Choose the group the page belongs to, or leave it out of the sidebar. Readers can still reach it from search and links.

### Save
Press :kbd[Ctrl] :kbd[S] or choose **Save**.
:::

## Addresses

Addresses use lowercase letters, numbers and hyphens, with `/` between folders, for example `guides/export-a-pdf`. A few words are reserved because the site uses them: `admin`, `api`, `search` and `uploads`.

## Drafts

Turn on **Draft** to keep a page hidden. Readers don't see drafts in the sidebar, search or `llms.txt`, and signed-in editors see them with a note at the top.

## As a file

A file at `content/pages/guides/export.md` is served at `/guides/export`.

```markdown
---
title: Export a document
description: Save a copy as PDF or Word.
draft: true
---

Your text here.
```
