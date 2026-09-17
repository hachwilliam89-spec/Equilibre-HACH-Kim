# syntax=docker/dockerfile:1

# ---- Stage 1 : dependances ----
# Installation unique des dependances (devDependencies comprises), partagee
# par le stage de developpement ET par le stage de build. Evite de rejouer
# deux fois le meme pnpm install, qui prenait plus de deux minutes.
FROM node:24-alpine AS deps

WORKDIR /app

# On copie uniquement les manifests avant le code pour profiter du cache
# Docker : les dependances ne sont reinstallees que si package.json ou le
# lockfile changent, pas a chaque modification de code.
COPY package.json pnpm-lock.yaml ./

# Sans argument de version, corepack active le gestionnaire declare dans le
# champ "packageManager" du package.json (pnpm@10.25.0) : exactement la meme
# version que sur la machine de developpement, donc build reproductible.
RUN corepack enable && corepack prepare --activate
# --frozen-lockfile echoue si le lockfile ne correspond pas au package.json,
# ce qui interdit toute installation divergente.
RUN pnpm install --frozen-lockfile

# ---- Stage 2 : developpement ----
# Utilise uniquement par docker-compose.dev.yml (target: development).
# Herite des dependances du stage deps et lance Nest en mode watch :
# combine au bind mount de ./api/src, cela donne le rechargement a chaud.
FROM deps AS development

COPY . .

EXPOSE 3000

# Meme sonde qu'en production, avec un delai de demarrage plus long : la
# compilation TypeScript en mode watch est plus lente qu'un dist/main.js
# deja compile.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["pnpm", "run", "start:dev"]

# ---- Stage 3 : build ----
# Compile le TypeScript vers dist/. Repart de deps, donc sans reinstallation.
FROM deps AS builder

COPY . .

RUN pnpm run build

# ---- Stage 4 : production ----
# Dernier stage du fichier, donc cible par defaut d'un build sans --target.
# Repart d'une image vierge : tout ce qui n'est pas explicitement recopie
# depuis builder est abandonne.
FROM node:24-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml ./

RUN corepack enable && corepack prepare --activate
# --prod exclut les devDependencies : ni compilateur, ni linter, ni framework
# de test dans l'image finale. Plus legere et moins exposee.
RUN pnpm install --frozen-lockfile --prod

# On ne recupere que le resultat compile, pas les sources TypeScript.
COPY --from=builder /app/dist ./dist

# Bonne pratique securite : ne pas tourner en root dans le conteneur.
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs
USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Forme exec : Node est le processus principal et recoit directement les
# signaux d'arret, ce qui permet une extinction propre du conteneur.
CMD ["node", "dist/main.js"]
