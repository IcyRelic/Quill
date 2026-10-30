---
title: "One-command install"
description: "Install Quill on a Linux server with a single command, then manage it with the quill command."
updated: "2026-10-30T12:00:00.000Z"
---

The installer sets up everything on a fresh Linux server: Docker, Quill, HTTPS and your admin account. It runs on Ubuntu and Debian, and on any Linux server that already has Docker.

```bash
curl -fsSL https://raw.githubusercontent.com/IcyRelic/Quill/main/install.sh | sudo bash
```

:::steps
### Answer a few questions
The installer asks how people will reach Quill, then for your admin account. After that it runs by itself for a few minutes.

| Choice | Use it when |
| --- | --- |
| Your own domain, automatic HTTPS | A fresh server with nothing else on ports 80 and 443. Caddy gets a free certificate from Let's Encrypt. |
| Your own domain, behind Cloudflare | The domain's DNS record is proxied by Cloudflare. Cloudflare's SSL mode can be Flexible or Full. |
| A web server you already run | nginx or Apache already serves other sites here. Quill listens on a local port, optionally under a path such as `/docs`, and the installer writes an nginx example. |
| Try it on the server's IP | A quick look, over plain HTTP. |

### Point your domain at the server
For the first two choices, add an `A` record for the domain with the server's IP address. HTTPS starts once it resolves.

### Sign in
Go to `/admin` on your new site and sign in with the account you made. Add more people under **Accounts**.
:::

## Install somewhere else

Quill goes in `/opt/quill` unless you set `QUILL_DIR`:

```bash
curl -fsSL https://raw.githubusercontent.com/IcyRelic/Quill/main/install.sh | sudo QUILL_DIR=/srv/docs bash
```

Each install is separate, so one server can run several. If the `quill` command already belongs to another install, the new one gets its own name, such as `quill-docs`. The installer tells you which.

## Add Quill to a site you already run

To serve the docs at an address like `https://example.com/docs`, next to a site nginx already serves:

:::steps
### Run the installer
Choose **3** (a web server on this machine). Pick a free port, and enter `/docs` as the path.

### Add the block it prints to your site
Put the `location ^~ /docs { ... }` block from `/opt/quill/nginx-example.conf` inside your site's `server { }` block, then check and reload nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Set the public address
Sign in at `https://example.com/docs/admin`. Under **Site settings**, set **Public address** to `https://example.com/docs`.
:::

:::note
Behind Cloudflare, nginx sees plain HTTP. In the block, send Cloudflare's own header instead: `proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;`. Quill then marks sign-in cookies as HTTPS-only.
:::

## The quill command

The installer adds a `quill` command for everything after setup.

| Command | What it does |
| --- | --- |
| `quill update` | Downloads the latest Quill and restarts with it. Content and accounts stay. |
| `quill user add` | Adds an account. `quill user list`, `passwd`, `role` and `remove` manage the rest. |
| `quill backup` | Saves pages, settings, uploads and accounts to a `.tar.gz` file. `quill restore <file>` puts them back. |
| `quill logs` | Shows what Quill has been doing. `quill status`, `restart`, `stop` and `start` do what they say. |

:::note
Quill lives in `/opt/quill`. The content is in a Docker volume, so updates never touch it.
:::
