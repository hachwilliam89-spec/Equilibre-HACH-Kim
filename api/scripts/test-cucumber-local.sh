#!/usr/bin/env bash
# Lance les scénarios Cucumber (pnpm test:cucumber) contre le Mongo de
# docker-compose.test.yml, sans avoir a re-taper les variables
# d'environnement a chaque fois.
#
# Prerequis : le conteneur mongo de test doit tourner --
#   pnpm docker:test  (ou : docker compose -p equilibre-test \
#     -f docker-compose.yml -f docker-compose.test.yml \
#     --env-file .env.test up -d mongo)

set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f ../.env.test ]; then
  echo "../.env.test introuvable -- voir .env.example a la racine du depot." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source ../.env.test
set +a

# .env.test pointe vers "mongo" (nom du service sur le reseau Docker
# interne, utilise par docker-compose.test.yml quand l'api tourne aussi
# en conteneur). Ici les tests tournent sur l'hote, donc on recible vers
# localhost:MONGO_PORT, le seul port expose par le conteneur mongo.
export MONGO_URI="mongodb://${MONGO_ROOT_USER}:${MONGO_ROOT_PASSWORD}@localhost:${MONGO_PORT}/equilibre_test?authSource=admin"

mkdir -p reports
export NODE_ENV=test
exec pnpm test:cucumber "$@"
