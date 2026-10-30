FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Serve Quill under a sub-path such as /docs: docker build --build-arg QUILL_BASE_PATH=/docs .
ARG QUILL_BASE_PATH=""
ENV QUILL_BASE_PATH=$QUILL_BASE_PATH
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 QUILL_CONTENT_DIR=/data/content
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Starter content, copied into the volume on first run only.
COPY --from=build /app/content ./starter-content
RUN printf '#!/bin/sh\nif [ ! -f /data/content/site.json ]; then mkdir -p /data/content && cp -r /app/starter-content/. /data/content/; fi\nexec node server.js\n' > /app/start.sh && chmod +x /app/start.sh
VOLUME /data
EXPOSE 3000
CMD ["/app/start.sh"]
