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

RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3000

CMD ["node", "dist/index.js"]
