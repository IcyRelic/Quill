---
title: "Accounts"
description: "Who can sign in to the admin portal, and what admins and editors can do."
updated: "2026-10-30T12:00:00.000Z"
---

Everyone who edits the docs signs in with their own account. Their name is shown as **Last edited by** on the pages they change.

| Role | Can do |
| --- | --- |
| Admin | Everything: pages, navigation, home page, files, appearance, site settings, API keys, connected apps and accounts. |
| Editor | Pages, navigation, the home page and files. |

## Add an account

Admins add accounts under **Accounts**: choose a username, a password of at least 8 characters and a role, then tell the person their username and password. They can change both their name and password under **Your account**.

Changing someone's password, or removing their account, signs them out at once.

## The first account

A new site has no accounts, and the sign-in page says how to make one. The [installer](/deploy/install) makes the first admin for you. Otherwise, on the server:

::::tabs
:::tab[Installer]
```bash
quill user add
```
:::
:::tab[Docker]
```bash
docker compose exec <service> node quill-user.mjs add
```
:::
:::tab[From the code]
```bash
npm run user -- add
```
:::
::::

The same command lists accounts (`list`), sets a new password (`passwd <username>`), changes a role (`role <username> admin`) and removes an account (`remove <username>`). It's the way back in if every admin forgets their password.

:::note
Quill always keeps at least one admin: the last one can't be removed or made an editor.
:::
