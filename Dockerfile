FROM cloudflare/cloudflared:2023.10.0 AS cloudflared

FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY public ./public
COPY --from=cloudflared /usr/local/bin/cloudflared /tmp/node-untun/cloudflared.2023.10.0

RUN chmod 0755 /tmp/node-untun/cloudflared.2023.10.0 \
    && mkdir -p /app/data \
    && chown -R node:node /app /tmp/node-untun

USER node

EXPOSE 3000

CMD ["node", "dist/index.js"]
