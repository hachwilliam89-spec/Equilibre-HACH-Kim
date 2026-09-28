#!/usr/bin/env bash
# Run on the target server, whose existing Compose project is equilibre-prod.
# Only the API is replaced. MongoDB and its volumes are never recreated.
set -Eeuo pipefail
umask 077

target=${1:?Fournir une image par digest}
[[ "$target" =~ ^ghcr\.io/hachwilliam89-spec/equilibre-api@sha256:[a-f0-9]{64}$ ]] || {
  echo "Une reference GHCR par digest est obligatoire." >&2; exit 2;
}
cd "${RECETTE_DIRECTORY:-$HOME/equilibre-prod}"
test -s .env.prod
test -s docker-compose.yml
test -s docker-compose.prod.yml
# Refuse the old Compose contract, which would silently ignore API_IMAGE.
grep -Fq '${API_IMAGE:?' docker-compose.prod.yml
command -v flock >/dev/null
exec 9>.deploy.lock
flock -n 9 || { echo "Un deploiement est deja en cours." >&2; exit 1; }

export API_IMAGE="$target"
compose() {
  docker compose --project-name equilibre-prod --env-file .env.prod \
    -f docker-compose.yml -f docker-compose.prod.yml "$@"
}
compose config --quiet
mongo=$(compose ps -q mongo)
test -n "$mongo"
test "$(docker inspect --format '{{.State.Health.Status}}' "$mongo")" = healthy
api=$(compose ps -q api)
test -n "$api" # Bootstrap is a separate, supervised operation.
test "$(docker inspect --format '{{.State.Health.Status}}' "$api")" = healthy
# Local image ID is immutable, unlike a mutable tag originally used to launch it.
previous=$(docker inspect --format '{{.Image}}' "$api")
[[ "$previous" =~ ^sha256:[a-f0-9]{64}$ ]]

# A pull failure happens before replacing the working API.
docker pull "$target"
rollback() {
  trap - ERR INT TERM
  echo "Deploiement en echec : restauration de l'image precedente." >&2
  export API_IMAGE="$previous"
  if compose up -d --no-deps --no-build --pull never --wait --wait-timeout 120 api; then
    printf 'API_IMAGE=%s\n' "$previous" > .env.release.tmp
    mv .env.release.tmp .env.release
    echo "Image precedente restauree. Le job reste en echec." >&2
  else
    echo "ECHEC DU RETOUR ARRIERE : intervention requise sur le VPS." >&2
  fi
  exit 1
}
# Covers health failure and catchable interruption after mutation starts.
trap rollback ERR INT TERM
compose up -d --no-deps --no-build --pull never --wait --wait-timeout 120 api
printf 'API_IMAGE=%s\n' "$previous" > .env.previous.tmp
mv .env.previous.tmp .env.previous
printf 'API_IMAGE=%s\n' "$target" > .env.release.tmp
mv .env.release.tmp .env.release
trap - ERR INT TERM
echo "Recette saine : $target"
