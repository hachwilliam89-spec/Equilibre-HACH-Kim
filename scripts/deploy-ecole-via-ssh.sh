#!/usr/bin/env bash
# Lance depuis le job deploy:ecole (runner de la salle 102).
# Copie les deux fichiers Compose sur le serveur n2 puis y execute
# deploy-ecole.sh avec l'image de la pipeline. Aucun code source, secret
# applicatif ni checkout Git n'est envoye.
set -euo pipefail

: "${ECOLE_HOST:?Configurer ECOLE_HOST}"
: "${ECOLE_USER:?Configurer ECOLE_USER}"
[[ "$ECOLE_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]] || exit 2
[[ "$ECOLE_USER" =~ ^[a-z_][a-z0-9_-]*$ ]] || exit 2
image=$(cat image.ref)
[[ "$image" =~ ^ghcr\.io/hachwilliam89-spec/equilibre-api@sha256:[a-f0-9]{64}$ ]] || exit 2

remote() {
  ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15 \
    "$ECOLE_USER@$ECOLE_HOST" "$@"
}

remote 'mkdir -p ~/equilibre-ecole' < /dev/null
for fichier in docker-compose.yml docker-compose.ecole.yml; do
  remote "cat > ~/equilibre-ecole/$fichier.tmp && mv ~/equilibre-ecole/$fichier.tmp ~/equilibre-ecole/$fichier" < "$fichier"
done
remote "bash -s -- '$image'" < scripts/deploy-ecole.sh
