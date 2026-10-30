---
title: "Code"
description: "Code blocks with highlighting and a copy button."
updated: "2026-10-28T12:00:00.000Z"
---

Fence code with three backticks and name the language for highlighting. Every block gets a **Copy** button.

```ts
export async function getPage(slug: string) {
  const res = await fetch(`/api/v1/pages/${slug}`);
  return (await res.json()).page;
}
```

````markdown
```ts
const page = await getPage("quickstart");
```
````

Common names are `bash`, `json`, `ts`, `js`, `tsx`, `html`, `css`, `python`, `yaml` and `markdown`. Use inline `code` for short things a reader types.
