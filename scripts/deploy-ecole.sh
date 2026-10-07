#!/usr/bin/env bash
# Execute sur le serveur ecole n2, dans ~/equilibre-ecole.
# Met l'API a jour avec l'image validee par la pipeline. MongoDB est demarre
# s'il ne tourne pas encore, mais ni lui ni son volume ne sont recrees.
# En cas d'echec apres modification, l'image precedente est restauree.
set -Eeuo pipefail
umask 077

target=${1:?Fournir une image par digest}
[[ "$target" =~ ^ghcr\.io/hachwilliam89-spec/equilibre-api@sha256:[a-f0-9]{64}$ ]] || {
  echo "Une reference GHCR par digest est obligatoire." >&2; exit 2;
}
cd "${ECOLE_DIRECTORY:-$HOME/equilibre-ecole}"
test -s .env.ecole || {
  echo "Fichier .env.ecole absent : le creer une fois sur le serveur (modele .env.example)." >&2; exit 2;
}
test -s docker-compose.yml
test -s docker-compose.ecole.yml
grep -Fq '${API_IMAGE:?' docker-compose.ecole.yml
command -v flock >/dev/null
exec 9>.deploy.lock
flock -n 9 || { echo "Un deploiement est deja en cours." >&2; exit 1; }

compose() {
  docker compose --project-name equilibre-ecole --env-file .env.ecole \
    -f docker-compose.yml -f docker-compose.ecole.yml "$@"
}
export API_IMAGE="$target"
compose config --quiet

# Derniere image deployee avec succes (vide au premier deploiement).
previous=""
if [[ -s .env.release ]]; then
  previous=$(sed -n 's/^API_IMAGE=//p' .env.release)
fi

# Un echec de telechargement survient avant toute modification.
docker pull "$target"
rollback() {
  trap - ERR INT TERM
  if [[ -z "$previous" ]]; then
    echo "Premier deploiement en echec : aucune image precedente a restaurer." >&2
    exit 1
  fi
  echo "Deploiement en echec : restauration de l'image precedente." >&2
  export API_IMAGE="$previous"
  if compose up -d --no-build --pull never --wait --wait-timeout 120 api; then
    echo "Image precedente restauree. Le job reste en echec." >&2
  else
    echo "ECHEC DU RETOUR ARRIERE : intervention requise sur le serveur ecole." >&2
  fi
  exit 1
}
trap rollback ERR INT TERM
# --pull missing : telecharge mongo:7.0 au premier deploiement ; l'API est
# deja presente (docker pull ci-dessus). --wait : attend que MongoDB et
# l'API soient sains (healthchecks).
compose up -d --no-build --pull missing --wait --wait-timeout 180
printf 'API_IMAGE=%s\n' "$target" > .env.release.tmp
mv .env.release.tmp .env.release
trap - ERR INT TERM
echo "Serveur ecole sain : $target"
