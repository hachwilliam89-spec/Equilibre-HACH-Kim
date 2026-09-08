# syntax=docker/dockerfile:1

# ---- Stage 1 : build ----
# Image officielle multi-arch (Apple Silicon M1/M2 + Intel) : aucune config particulière requise
FROM node:20-alpine AS builder

WORKDIR /app

# On copie uniquement les manifests d'abord pour profiter du cache Docker
# (les dépendances ne sont réinstallées que si package.json change, pas à chaque modif de code)
COPY package.json pnpm-lock.yaml ./

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

# ---- Stage 2 : production ----
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml ./

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile --prod

# On ne récupère que le résultat compilé du stage précédent, pas les sources TS ni les devDependencies
COPY --from=builder /app/dist ./dist

# Bonne pratique sécurité : ne pas tourner en root dans le conteneur
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs
USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "dist/main.js"]