---
title: "Navigation"
description: "Read and replace the sidebar, including dropdowns."
updated: "2026-10-28T12:00:00.000Z"
---

The sidebar is a list of groups. A group's `pages` holds page addresses in order; an object in that list is a dropdown.

```json
{
  "navigation": [
    {
      "title": "Get started",
      "pages": [
        "introduction",
        "quickstart",
        { "title": "Deploy", "pages": ["deploy/docker", "deploy/server"] }
      ]
    }
  ]
}
```

`PUT /api/v1/navigation` replaces the whole sidebar with what you send. Each page can appear once; later repeats are dropped. To place a single page, it's simpler to send `group` and `folder` with the page itself.
