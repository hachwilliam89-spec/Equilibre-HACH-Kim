#!/usr/bin/env bash
# Contract tests with a fake Docker: never touch real services or volumes.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/bin" "$work/home/equilibre-prod"
cp "$root/docker-compose.yml" "$root/docker-compose.prod.yml" "$work/home/equilibre-prod/"
printf 'NODE_ENV=production\n' > "$work/home/equilibre-prod/.env.prod"
export TEST_LOG="$work/calls" TEST_CASE=success
export TEST_OLD="sha256:$(printf 'b%.0s' {1..64})"
target="ghcr.io/hachwilliam89-spec/equilibre-api@sha256:$(printf 'a%.0s' {1..64})"
cat > "$work/bin/docker" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf '%s | %s\n' "${API_IMAGE:-}" "$*" >> "$TEST_LOG"
case "$*" in
  'compose '*config*) exit 0 ;;
  'compose '*' ps -q mongo') echo mongo ;;
  'compose '*' ps -q api') echo api ;;
  'inspect --format {{.State.Health.Status}} mongo')
    if [[ "$TEST_CASE" == mongo-down ]]; then echo unhealthy; else echo healthy; fi ;;
  'inspect --format {{.State.Health.Status}} api') echo healthy ;;
  'inspect --format {{.Image}} api') echo "$TEST_OLD" ;;
  'pull '*) [[ "$TEST_CASE" != pull-failure ]] ;;
  'compose '*up*)
    [[ "$*" == *'--no-deps --no-build --pull never --wait --wait-timeout 120 api' ]]
    if [[ "$TEST_CASE" == rollback-failure ]]; then exit 1; fi
    if [[ "$TEST_CASE" == health-failure && "$API_IMAGE" != "$TEST_OLD" ]]; then exit 1; fi ;;
  *) echo "Unexpected Docker call: $*" >&2; exit 10 ;;
esac
MOCK
cat > "$work/bin/flock" <<'MOCK'
#!/usr/bin/env bash
[[ "$TEST_CASE" != locked ]]
MOCK
chmod +x "$work/bin/docker" "$work/bin/flock"
run() {
  env RECETTE_DIRECTORY="$work/home/equilibre-prod" PATH="$work/bin:$PATH" bash "$root/scripts/deploy-recette.sh" "$1" > "$work/result" 2>&1
}
run "$target" || { cat "$work/result" >&2; exit 1; }
grep -Fq "API_IMAGE=$target" "$work/home/equilibre-prod/.env.release"
grep -Fq "API_IMAGE=$TEST_OLD" "$work/home/equilibre-prod/.env.previous"
for TEST_CASE in invalid locked mongo-down pull-failure health-failure rollback-failure; do
  export TEST_CASE
  : > "$TEST_LOG"
  value="$target"
  [[ "$TEST_CASE" != invalid ]] || value=ghcr.io/hachwilliam89-spec/equilibre-api:latest
  if run "$value"; then echo "Unexpected success: $TEST_CASE" >&2; cat "$TEST_LOG" "$work/result" >&2; exit 1; fi
  case "$TEST_CASE" in
    invalid|locked|mongo-down|pull-failure)
      if grep -q ' up ' "$TEST_LOG"; then echo "Premature mutation: $TEST_CASE" >&2; exit 1; fi ;;
    health-failure)
      grep -Fq "API_IMAGE=$TEST_OLD" "$work/home/equilibre-prod/.env.release"
      grep -q 'Image precedente restauree' "$work/result" ;;
    rollback-failure) grep -q 'ECHEC DU RETOUR ARRIERE' "$work/result" ;;
  esac
  if grep -Eq ' down |volume| up .*mongo' "$TEST_LOG"; then exit 1; fi
done
echo '7 scenarios de deploiement valides (Docker simule).'

# Verify the SSH boundary without opening a connection.
cat > "$work/bin/ssh" <<'MOCK'
#!/usr/bin/env bash
printf '%s\n' "$@" > "$TEST_LOG"
cat > "$TEST_REMOTE_SCRIPT"
MOCK
chmod +x "$work/bin/ssh"
mkdir -p "$work/ssh/scripts"
cp "$root/scripts/deploy-recette.sh" "$work/ssh/scripts/"
export TEST_REMOTE_SCRIPT="$work/remote-script"
ssh_run() {
  (cd "$work/ssh" && env PATH="$work/bin:$PATH" DEPLOY_HOST="$1" DEPLOY_USER="$2" \
    bash "$root/scripts/deploy-via-ssh.sh")
}
printf '%s\n' "$target" > "$work/ssh/image.ref"
ssh_run recette.example.test deploy
cmp "$TEST_REMOTE_SCRIPT" "$root/scripts/deploy-recette.sh"
grep -Fxq 'StrictHostKeyChecking=yes' "$TEST_LOG"
grep -Fxq 'deploy@recette.example.test' "$TEST_LOG"
grep -Fxq "bash -s -- '$target'" "$TEST_LOG"
for case_name in host user image missing; do
  : > "$TEST_LOG"
  host=recette.example.test
  user=deploy
  printf '%s\n' "$target" > "$work/ssh/image.ref"
  case "$case_name" in
    host) host='-oProxyCommand=bad' ;;
    user) user='deploy;bad' ;;
    image) printf '%s\n' 'ghcr.io/hachwilliam89-spec/equilibre-api:latest' > "$work/ssh/image.ref" ;;
    missing) : > "$work/ssh/image.ref" ;;
  esac
  if ssh_run "$host" "$user" > "$work/result" 2>&1; then
    echo "Unexpected SSH success: $case_name" >&2; exit 1
  fi
  test ! -s "$TEST_LOG"
done
echo '5 scenarios SSH valides (SSH simule, aucune connexion).'
