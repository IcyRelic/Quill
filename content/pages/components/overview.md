---
title: "Overview"
description: "Every block you can use in a page, at a glance."
updated: "2026-10-28T12:00:00.000Z"
---

Components are short blocks of Markdown that start and end with colons. They work the same in the editor, in files and through the API.

| Component | Write | Use it for |
| --- | --- | --- |
| [Callouts](/components/callouts) | `:::tip` | Notes, tips and warnings |
| [Steps](/components/steps) | `:::steps` | Numbered instructions |
| [Tabs](/components/tabs) | `::::tabs` | Instructions that differ by device |
| [Accordions](/components/accordions) | `:::accordion[Question]` | Questions and answers |
| [Code](/components/code) | three backticks | Commands and code |
| [Media](/components/media) | `![alt](/uploads/...)` | Images and video |
| Keys | `:kbd[Ctrl]` | Keyboard keys |
| Link cards | `:::links` | Related pages |

## Nesting

To put one block inside another, give the outer block one more colon.

```markdown
::::tabs
:::tab[Mac]
Hold Option to see more.
:::
::::
```

## Link cards

:::links
- [Callouts](/components/callouts): draw attention to one thing.
- [Steps](/components/steps): walk a reader through a task.
:::

```markdown
:::links
- [Callouts](/components/callouts): draw attention to one thing.
- [Steps](/components/steps): walk a reader through a task.
:::
```
