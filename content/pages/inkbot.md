---
title: "Connect InkBot"
description: "Let your InkBot bots read and update the docs through the API."
updated: "2026-10-29T12:00:00.000Z"
---

Quill is built to be kept up to date by bots. A bot with an API key can add a page when a feature ships, append a question to the FAQ, or fix a step that changed.

:::steps
### Create a key
In the admin portal, open **API keys**, name the key after the bot and choose **Create key**. Copy it straight away: it is shown only once. Make one key per bot, so you can revoke one without the others.

### Give the bot the address and the key
Tell the bot your site's address and its key. It sends the key on every write:

```http
Authorization: Bearer <key>
```

### Point it at the map
`/llms.txt` lists every page in plain text and `/api/v1/openapi.json` describes every endpoint. Most bots need nothing else to get started.
:::

## A typical update

```bash
curl -X PATCH https://docs.example.org/api/v1/pages/help/faq \
  -H "Authorization: Bearer $QUILL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"appendBody":":::accordion[Can I export to PDF?]\nYes. Choose File, then Export.\n:::"}'
```

:::warning
A key can change any page. Give keys only to bots you trust, and revoke a key under **API keys** when a bot no longer needs it.
:::
