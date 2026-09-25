#!/usr/bin/env bash
set -euo pipefail

# Host/user are validated before entering the SSH destination or command.
: "${DEPLOY_HOST:?Configurer DEPLOY_HOST}"
: "${DEPLOY_USER:?Configurer DEPLOY_USER}"
[[ "$DEPLOY_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]] || exit 2
[[ "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]*$ ]] || exit 2
image=$(cat image.ref)
[[ "$image" =~ ^ghcr\.io/hachwilliam89-spec/equilibre-api@sha256:[a-f0-9]{64}$ ]] || exit 2

# No application source, environment secret or Git checkout is sent.
# The two Compose files are provisioned separately on the target server.
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15 \
  "$DEPLOY_USER@$DEPLOY_HOST" "bash -s -- '$image'" < scripts/deploy-recette.sh
