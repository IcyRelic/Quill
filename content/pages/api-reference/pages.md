---
title: "Pages"
description: "Create, read, update, move and delete pages."
updated: "2026-10-28T12:00:00.000Z"
---

## Create or replace

```bash
curl -X PUT https://docs.example.org/api/v1/pages/guides/print \
  -H "Authorization: Bearer $QUILL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Print a document",
    "description": "Print on paper or save a PDF.",
    "group": "Guides",
    "body": "Choose **File**, then **Print**."
  }'
```

| Field | Type | Notes |
| --- | --- | --- |
| `title` | string | Required. |
| `description` | string | Shown under the title and in search. |
| `body` | string | Markdown. |
| `draft` | boolean | Hidden from readers when true. |
| `group` | string | Sidebar group, created if missing. |
| `folder` | string | Dropdown inside the group, created if missing. |
| `position` | integer | Place in the group or dropdown, from 0. |

## Change some fields

`PATCH` changes only the fields you send. Two extra fields help bots:

- `appendBody` adds Markdown to the end of the page.
- `newSlug` moves the page to a new address, along with its place in the sidebar.

```json
{ "appendBody": "## Printing on both sides\nChoose **Two-sided**." }
```

## Read

`GET /api/v1/pages/{slug}` returns the page with its Markdown. Add `?html=1` to also get the rendered HTML and the list of headings.
