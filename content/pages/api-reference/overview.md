---
title: "Overview"
description: "How the API works: addresses, formats and errors."
updated: "2026-10-28T12:00:00.000Z"
---

The API lives at `/api/v1` on your site. It sends and receives JSON, and every change is live as soon as the call returns.

## Endpoints

| Method | Path | What it does |
| --- | --- | --- |
| `GET` | `/api/v1/pages` | List pages |
| `POST` | `/api/v1/pages` | Create a page |
| `GET` | `/api/v1/pages/{slug}` | Read a page |
| `PUT` | `/api/v1/pages/{slug}` | Create or replace a page |
| `PATCH` | `/api/v1/pages/{slug}` | Change fields, append, or move |
| `DELETE` | `/api/v1/pages/{slug}` | Delete a page |
| `GET` `PUT` | `/api/v1/navigation` | Read or replace the sidebar |
| `GET` `PATCH` `PUT` | `/api/v1/site` | Read or change site settings |
| `GET` | `/api/v1/search?q=` | Search pages |
| `POST` | `/api/v1/preview` | Render Markdown without saving |
| `GET` `POST` | `/api/v1/uploads` | List or upload files |

The full description is at `/api/v1/openapi.json`.

## Errors

Errors come back with a status code and a sentence that says what to change.

```json
{ "error": "A page needs a title." }
```

| Status | Meaning |
| --- | --- |
| `400` | The request is missing something or has the wrong shape. |
| `401` | No key, or the key isn't recognised. |
| `404` | Nothing at that address. |
| `409` | A page already exists at that address. |
