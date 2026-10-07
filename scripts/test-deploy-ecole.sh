#!/usr/bin/env bash
# Tests de contrat de deploy-ecole.sh avec un faux Docker : aucun service ni
# volume reel n'est touche.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
dir="$work/home/equilibre-ecole"
mkdir -p "$work/bin" "$dir"
cp "$root/docker-compose.yml" "$root/docker-compose.ecole.yml" "$dir/"
printf 'NODE_ENV=production\n' > "$dir/.env.ecole"
export TEST_LOG="$work/calls" TEST_CASE=success
old="ghcr.io/hachwilliam89-spec/equilibre-api@sha256:$(printf 'b%.0s' {1..64})"
target="ghcr.io/hachwilliam89-spec/equilibre-api@sha256:$(printf 'a%.0s' {1..64})"
export TEST_OLD="$old"
cat > "$work/bin/docker" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf '%s | %s\n' "${API_IMAGE:-}" "$*" >> "$TEST_LOG"
case "$*" in
  'compose '*config*) exit 0 ;;
  'pull '*) [[ "$TEST_CASE" != pull-failure ]] ;;
  'compose '*up*)
    [[ "$*" == *'--no-build --pull never --wait'* ]]
    if [[ "$TEST_CASE" == rollback-failure ]]; then exit 1; fi
    if [[ "$TEST_CASE" == health-failure* && "$API_IMAGE" != "$TEST_OLD" ]]; then exit 1; fi ;;
  *) echo "Appel Docker inattendu : $*" >&2; exit 10 ;;
esac
MOCK
cat > "$work/bin/flock" <<'MOCK'
#!/usr/bin/env bash
[[ "$TEST_CASE" != locked ]]
MOCK
chmod +x "$work/bin/docker" "$work/bin/flock"
run() {
  env ECOLE_DIRECTORY="$dir" PATH="$work/bin:$PATH" bash "$root/scripts/deploy-ecole.sh" "$1" > "$work/result" 2>&1
}
fail() { echo "$1" >&2; cat "$TEST_LOG" "$work/result" >&2; exit 1; }

# Premier deploiement : aucune release precedente, MongoDB et l'API demarrent.
: > "$TEST_LOG"
run "$target" || fail "Echec inattendu : premier deploiement"
grep -Fxq "API_IMAGE=$target" "$dir/.env.release" || fail "Release non enregistree"

# Mise a jour depuis une release saine.
printf 'API_IMAGE=%s\n' "$old" > "$dir/.env.release"
: > "$TEST_LOG"
run "$target" || fail "Echec inattendu : mise a jour"
grep -Fxq "API_IMAGE=$target" "$dir/.env.release" || fail "Release non mise a jour"

for TEST_CASE in invalid missing-env locked pull-failure health-failure health-failure-first rollback-failure; do
  export TEST_CASE
  : > "$TEST_LOG"
  printf 'API_IMAGE=%s\n' "$old" > "$dir/.env.release"
  value="$target"
  [[ "$TEST_CASE" != invalid ]] || value=ghcr.io/hachwilliam89-spec/equilibre-api:latest
  [[ "$TEST_CASE" != health-failure-first ]] || rm "$dir/.env.release"
  [[ "$TEST_CASE" != missing-env ]] || mv "$dir/.env.ecole" "$dir/.env.ecole.bak"
  if run "$value"; then fail "Succes inattendu : $TEST_CASE"; fi
  [[ "$TEST_CASE" != missing-env ]] || mv "$dir/.env.ecole.bak" "$dir/.env.ecole"
  case "$TEST_CASE" in
    invalid|missing-env|locked|pull-failure)
      if grep -q ' up ' "$TEST_LOG"; then fail "Modification prematuree : $TEST_CASE"; fi ;;
    health-failure)
      grep -Fq "$old | compose" "$TEST_LOG" || fail "Pas de retour arriere"
      grep -q 'Image precedente restauree' "$work/result" || fail "Message de restauration absent"
      grep -Fxq "API_IMAGE=$old" "$dir/.env.release" || fail "Release modifiee malgre l'echec" ;;
    health-failure-first)
      grep -q 'aucune image precedente' "$work/result" || fail "Message premier deploiement absent"
      [[ ! -e "$dir/.env.release" ]] || fail "Release ecrite malgre l'echec" ;;
    rollback-failure)
      grep -q 'ECHEC DU RETOUR ARRIERE' "$work/result" || fail "Message d'echec du retour absent" ;;
  esac
  if grep -Eq ' down |volume' "$TEST_LOG"; then fail "Action destructive : $TEST_CASE"; fi
done
echo '9 scenarios de deploiement ecole valides (Docker simule).'
