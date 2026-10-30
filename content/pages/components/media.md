---
title: "Images and video"
description: "Add screenshots, diagrams and short clips."
updated: "2026-10-28T12:00:00.000Z"
---

Upload files on the **Files** screen in the admin portal, or with the API. Each upload gets an address under `/uploads/` to use in a page.

## Images

```markdown
![The Settings screen with Sync turned on](/uploads/settings-sync.png)
```

Write the alt text as a short description of what the picture shows. Images fill the width of the text and load as the reader scrolls.

## Video

```markdown
::video{src="/uploads/walkthrough.mp4"}
```

Video plays muted with controls. Keep clips short and use MP4 or WebM.

## Allowed files

PNG, JPG, GIF, WebP, AVIF, SVG, MP4, WebM and PDF, up to 15 MB each.
