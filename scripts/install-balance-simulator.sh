#!/usr/bin/env bash
# Installe sur la recette un lancement quotidien du simulateur, sans copier le depot.
set -Eeuo pipefail
umask 077

target=${1:?Fournir une image du simulateur par digest}
[[ "$target" =~ ^ghcr\.io/hachwilliam89-spec/equilibre-balance-simulator@sha256:[a-f0-9]{64}$ ]] || {
  echo "Une reference GHCR du simulateur par digest est obligatoire." >&2
  exit 2
}

directory=${RECETTE_DIRECTORY:-$HOME/equilibre-prod}
[[ "$directory" =~ ^/[a-zA-Z0-9._/-]+$ ]] || {
  echo "RECETTE_DIRECTORY contient des caracteres non autorises." >&2
  exit 2
}
cd "$directory"

test -s .env.simulator || {
  echo "Le fichier $directory/.env.simulator est absent ou vide." >&2
  exit 1
}
chmod 600 .env.simulator
command -v docker >/dev/null
command -v crontab >/dev/null
command -v flock >/dev/null
docker network inspect equilibre-prod_equilibre-network >/dev/null
test "$(docker inspect --format '{{.State.Health.Status}}' equilibre-api)" = healthy

# Le pull precede toute modification de la planification existante.
docker pull "$target"

runner="$directory/run-balance-simulator.sh"
cat > "$runner.tmp" <<RUNNER
#!/usr/bin/env bash
set -Eeuo pipefail
cd '$directory'
exec 9>.balance-simulator.lock
flock -n 9 || { echo "Une simulation est deja en cours." >&2; exit 1; }
exec docker run --rm \\
  --network equilibre-prod_equilibre-network \\
  --read-only \\
  --cap-drop ALL \\
  --security-opt no-new-privileges \\
  --env-file .env.simulator \\
  --env SIMULATOR_API_URL=http://equilibre-api:3000/api \\
  '$target' --once
RUNNER
chmod 700 "$runner.tmp"
mv "$runner.tmp" "$runner"

if [[ -s .simulator-image.release ]]; then
  cp .simulator-image.release .simulator-image.previous.tmp
  mv .simulator-image.previous.tmp .simulator-image.previous
fi
printf '%s\n' "$target" > .simulator-image.release.tmp
mv .simulator-image.release.tmp .simulator-image.release

mkdir -p logs
touch logs/balance-simulator.log
chmod 700 logs
chmod 600 logs/balance-simulator.log

begin='# BEGIN equilibre-balance-simulator'
end='# END equilibre-balance-simulator'
cron_tmp=$(mktemp)
trap 'rm -f "$cron_tmp"' EXIT
(crontab -l 2>/dev/null || true) | awk -v begin="$begin" -v end="$end" '
  $0 == begin { skip = 1; next }
  $0 == end { skip = 0; next }
  !skip { print }
' > "$cron_tmp"
{
  printf '%s\n' "$begin"
  printf '0 6 * * * %s >> %s 2>&1\n' "$runner" "$directory/logs/balance-simulator.log"
  printf '%s\n' "$end"
} >> "$cron_tmp"
crontab "$cron_tmp"

echo "Simulateur installe : lancement quotidien a 06:00 (heure du serveur)."
echo "Image : $target"
echo "Journal : $directory/logs/balance-simulator.log"
