---
title: "Search and uploads"
description: "Search pages, render previews and upload files."
updated: "2026-10-28T12:00:00.000Z"
---

## Search

`GET /api/v1/search?q=export` returns the best matches with a short excerpt. It searches titles, descriptions, headings and text.

## Preview

`POST /api/v1/preview` with `{ "body": "..." }` returns the rendered HTML without saving anything. Useful for checking a page before writing it.

## Uploads

Send a file as `multipart/form-data` with a `file` field, or as JSON with `name` and base64 `data`.

```bash
curl -X POST https://docs.example.org/api/v1/uploads \
  -H "Authorization: Bearer $QUILL_API_KEY" \
  -F file=@diagram.png
```

The response includes the file's `url`, ready to use in a page.
