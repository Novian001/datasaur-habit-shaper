FROM node:20-alpine AS build

WORKDIR /app

# lockfile-driven install; node_modules are container-local (R21)
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig.json ./
COPY prisma.config.ts ./
COPY src ./src
RUN npm run build

FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY --from=build /app/dist ./dist
COPY prisma.config.ts ./
COPY entrypoint.sh ./

RUN chmod +x entrypoint.sh

EXPOSE 3000

USER node

CMD ["/app/entrypoint.sh"]
