FROM node:20-alpine AS build

WORKDIR /app

# lockfile-driven install; node_modules are container-local (R21)
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig.json ./
COPY prisma.config.ts ./
COPY vitest.config.ts ./
COPY test ./test
COPY src ./src

# Generate the Prisma client (custom output: src/generated/prisma).
# Runs AFTER COPY src so tsc compiles against the client generated from the
# CURRENT schema (human-review correction 2026-08-12: startDate added).
RUN npx prisma generate

RUN npm run build

FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Regenerate the client in the runtime stage (node_modules are fresh here)
RUN npx prisma generate

COPY --from=build /app/dist ./dist
COPY --from=build /app/src/generated ./src/generated
COPY prisma.config.ts ./
COPY entrypoint.sh ./

RUN chmod +x entrypoint.sh

EXPOSE 3000

USER node

CMD ["/app/entrypoint.sh"]
