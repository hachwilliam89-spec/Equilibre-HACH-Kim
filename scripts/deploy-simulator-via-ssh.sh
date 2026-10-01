#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_HOST:?Configurer DEPLOY_HOST}"
: "${DEPLOY_USER:?Configurer DEPLOY_USER}"
[[ "$DEPLOY_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]] || exit 2
[[ "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]*$ ]] || exit 2
image=$(cat simulator-image.ref)
[[ "$image" =~ ^ghcr\.io/hachwilliam89-spec/equilibre-balance-simulator@sha256:[a-f0-9]{64}$ ]] || exit 2

# Seul le script d'installation et le digest transitent. Les identifiants du
# compte simule restent dans .env.simulator sur le VPS.
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15 \
  "$DEPLOY_USER@$DEPLOY_HOST" "bash -s -- '$image'" < scripts/install-balance-simulator.sh
