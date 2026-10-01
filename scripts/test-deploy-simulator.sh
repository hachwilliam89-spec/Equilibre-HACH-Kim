#!/usr/bin/env bash
# Tests de contrat sans Docker, crontab ni connexion SSH reels.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/bin" "$work/home/equilibre-prod"
printf 'SIMULATOR_EMAIL=user@example.test\nSIMULATOR_PASSWORD=secret\n' > "$work/home/equilibre-prod/.env.simulator"
export TEST_LOG="$work/calls" TEST_CRONTAB="$work/crontab" TEST_CASE=success
target="ghcr.io/hachwilliam89-spec/equilibre-balance-simulator@sha256:$(printf 'a%.0s' {1..64})"

cat > "$work/bin/docker" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$TEST_LOG"
case "$*" in
  'network inspect equilibre-prod_equilibre-network') exit 0 ;;
  'inspect --format {{.State.Health.Status}} equilibre-api') echo healthy ;;
  'pull '*) [[ "$TEST_CASE" != pull-failure ]] ;;
  'run '*) [[ "$TEST_CASE" != runtime-failure ]] ;;
  *) echo "Unexpected Docker call: $*" >&2; exit 10 ;;
esac
MOCK
cat > "$work/bin/crontab" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == -l ]]; then
  [[ -f "$TEST_CRONTAB" ]] && cat "$TEST_CRONTAB"
else
  cp "$1" "$TEST_CRONTAB"
fi
MOCK
cat > "$work/bin/flock" <<'MOCK'
#!/usr/bin/env bash
exit 0
MOCK
chmod +x "$work/bin/docker" "$work/bin/crontab" "$work/bin/flock"

install_simulator() {
  env HOME="$work/home" RECETTE_DIRECTORY="$work/home/equilibre-prod" \
    PATH="$work/bin:$PATH" bash "$root/scripts/install-balance-simulator.sh" "$1" \
    > "$work/result" 2>&1
}

install_simulator "$target" || { cat "$work/result" >&2; exit 1; }
grep -Fxq "$target" "$work/home/equilibre-prod/.simulator-image.release"
grep -Fq '0 6 * * *' "$TEST_CRONTAB"
test "$(grep -Fc '# BEGIN equilibre-balance-simulator' "$TEST_CRONTAB")" -eq 1
runner="$work/home/equilibre-prod/run-balance-simulator.sh"
grep -Fq -- '--read-only' "$runner"
grep -Fq -- '--cap-drop ALL' "$runner"
grep -Fq -- '--security-opt no-new-privileges' "$runner"
grep -Fq 'SIMULATOR_API_URL=http://equilibre-api:3000/api' "$runner"
grep -Fq "'$target' --once" "$runner"

# Une reinstallation remplace le bloc cron sans doublon et conserve l'image precedente.
second="ghcr.io/hachwilliam89-spec/equilibre-balance-simulator@sha256:$(printf 'b%.0s' {1..64})"
install_simulator "$second"
test "$(grep -Fc '# BEGIN equilibre-balance-simulator' "$TEST_CRONTAB")" -eq 1
grep -Fxq "$target" "$work/home/equilibre-prod/.simulator-image.previous"
grep -Fxq "$second" "$work/home/equilibre-prod/.simulator-image.release"

# Une erreur d'execution ne supprime pas la planification du lendemain.
export TEST_CASE=runtime-failure
if env PATH="$work/bin:$PATH" bash "$runner" > "$work/result" 2>&1; then
  echo 'Unexpected runtime success' >&2; exit 1
fi
grep -Fq '# BEGIN equilibre-balance-simulator' "$TEST_CRONTAB"

for case_name in invalid missing-env pull-failure; do
  export TEST_CASE=$case_name
  value="$target"
  [[ "$case_name" != invalid ]] || value='ghcr.io/hachwilliam89-spec/equilibre-balance-simulator:latest'
  if [[ "$case_name" == missing-env ]]; then mv "$work/home/equilibre-prod/.env.simulator" "$work/env.saved"; fi
  if install_simulator "$value"; then echo "Unexpected success: $case_name" >&2; exit 1; fi
  if [[ "$case_name" == missing-env ]]; then mv "$work/env.saved" "$work/home/equilibre-prod/.env.simulator"; fi
done
echo '6 scenarios du planificateur valides (Docker et crontab simules).'

# Frontiere SSH : validation locale avant toute connexion.
cat > "$work/bin/ssh" <<'MOCK'
#!/usr/bin/env bash
printf '%s\n' "$@" > "$TEST_LOG"
cat > "$TEST_REMOTE_SCRIPT"
MOCK
chmod +x "$work/bin/ssh"
mkdir -p "$work/ssh/scripts"
cp "$root/scripts/install-balance-simulator.sh" "$work/ssh/scripts/"
export TEST_REMOTE_SCRIPT="$work/remote-script"
ssh_run() {
  (cd "$work/ssh" && env PATH="$work/bin:$PATH" DEPLOY_HOST="$1" DEPLOY_USER="$2" \
    bash "$root/scripts/deploy-simulator-via-ssh.sh")
}
printf '%s\n' "$target" > "$work/ssh/simulator-image.ref"
ssh_run recette.example.test deploy
cmp "$TEST_REMOTE_SCRIPT" "$root/scripts/install-balance-simulator.sh"
grep -Fxq 'StrictHostKeyChecking=yes' "$TEST_LOG"
grep -Fxq 'deploy@recette.example.test' "$TEST_LOG"
grep -Fxq "bash -s -- '$target'" "$TEST_LOG"
for case_name in host user image missing; do
  : > "$TEST_LOG"
  host=recette.example.test user=deploy
  printf '%s\n' "$target" > "$work/ssh/simulator-image.ref"
  case "$case_name" in
    host) host='-oProxyCommand=bad' ;;
    user) user='deploy;bad' ;;
    image) printf '%s\n' 'ghcr.io/hachwilliam89-spec/equilibre-balance-simulator:latest' > "$work/ssh/simulator-image.ref" ;;
    missing) : > "$work/ssh/simulator-image.ref" ;;
  esac
  if ssh_run "$host" "$user" > "$work/result" 2>&1; then
    echo "Unexpected SSH success: $case_name" >&2; exit 1
  fi
  test ! -s "$TEST_LOG"
done
echo '5 scenarios SSH valides (aucune connexion reelle).'
