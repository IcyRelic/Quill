---
title: "Docker"
description: "Run Quill in a container with its content on a volume."
updated: "2026-10-28T12:00:00.000Z"
---

On a Linux server, the [one-command install](/deploy/install) does all of this for you. To set it up by hand: the project includes a `Dockerfile`. The image builds the site and keeps your content on a volume at `/data`, so it survives restarts and upgrades.

:::steps
### Build the image

```bash
docker build -t quill-docs .
```

To serve the docs under a sub-path such as `/docs`, add `--build-arg QUILL_BASE_PATH=/docs`. See [Node server](/deploy/server) for the proxy settings.

### Run it with a volume

```bash
docker run -p 3000:3000 -v quill-data:/data \
  -e QUILL_SESSION_SECRET=... \
  -e QUILL_API_KEYS=... \
  quill-docs
```

### Check the first start
On the first start the sample content is copied into the volume. After that, the volume is the source of truth and the image never overwrites it.

### Make your account
Make the first admin account inside the container. It asks for a username and password.

```bash
docker exec -it <container> node quill-user.mjs add
```
:::

:::warning
Without `-v`, edits are saved inside the container and are lost when it is removed.
:::
