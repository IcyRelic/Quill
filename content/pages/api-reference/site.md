---
title: "Site settings"
description: "Read and change the name, links, home page and footer."
updated: "2026-10-28T12:00:00.000Z"
---

`GET /api/v1/site` returns every setting. `PATCH` merges what you send, one level deep, so you can change a single field.

```bash
curl -X PATCH https://docs.example.org/api/v1/site \
  -H "Authorization: Bearer $QUILL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"copyright": "© {year} Acme Inc."}'
```

| Field | What it holds |
| --- | --- |
| `name`, `tagline` | Shown beside the logo. |
| `description` | For search engines and `llms.txt`. |
| `links` | Top bar links: `[{ "label", "href" }]`. |
| `home` | `title`, `lead` and `cards`. |
| `copyright` | The footer line. |
