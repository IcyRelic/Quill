---
title: "Authentication"
description: "Send an API key with every write."
updated: "2026-10-29T12:00:00.000Z"
---

Reading published pages needs no key. Writing, reading drafts and listing uploads need one.

```http
Authorization: Bearer <key>
```

Make keys in the admin portal under **API keys**: name each one after the bot or script that uses it. The key is shown once, when you make it; Quill stores only a fingerprint of it, and lists each key by its last four characters with when it was made and last used. **Revoke** stops a key at once.

Keys in the `QUILL_API_KEYS` environment variable (comma-separated) still work. The portal lists them as legacy keys; to revoke one, remove it from the variable and restart Quill.

Each key has full write access to pages, navigation, settings and files. Keys can't make or revoke other keys: that needs a signed-in admin.

:::danger
Keep keys out of pages, screenshots and source control. Anyone with a key can change or delete any page.
:::
