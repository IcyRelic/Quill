---
title: "Troubleshooting"
description: "Fixes for the problems people run into most."
updated: "2026-10-28T12:00:00.000Z"
---

## The admin portal says it isn't set up

`QUILL_SESSION_SECRET` is missing or shorter than 16 characters. Set it in `.env.local` (the installer sets it for you) and restart.

## The sign-in page says there are no accounts

Make the first one on the server. See [Accounts](/admin-portal/accounts#the-first-account).

## Everyone forgot their password

On the server, `quill user passwd <username>` sets a new one (from the code, `npm run user -- passwd <username>`).

## Bots get 401 errors

The key isn't in `QUILL_API_KEYS`, or Quill wasn't restarted after it was added. Check that the header reads `Authorization: Bearer <key>` with one space.

## Edits disappear after a restart

The host has no persistent disk. On Docker, run with `-v quill-data:/data`. See [Choosing a host](/deploy/hosting).

## A page is missing from the sidebar

It's a draft, or it isn't in any group. Open **Navigation** in the admin portal; pages not in the sidebar are listed on the right.

:::tip
Still stuck? The server log shows the reason for any `500` error.
:::
