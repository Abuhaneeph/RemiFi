#!/usr/bin/env bash
# Deploy RemifiVault. On Windows use Git Bash — PowerShell breaks forge.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="$(cd "$ROOT/.." && pwd)"
cd "$ROOT"

if [[ -f "$REPO/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO/.env"
  set +a
fi

: "${CELO_RPC_URL:?Set CELO_RPC_URL in .env or environment}"
: "${AGENT_PRIVATE_KEY:?Set AGENT_PRIVATE_KEY in .env or environment}"

CLAIM_PERIOD_SECONDS="${CLAIM_PERIOD_SECONDS:-2592000}"

echo "Deploying RemifiVault (claim period: ${CLAIM_PERIOD_SECONDS}s)"
echo "RPC: ${CELO_RPC_URL}"

forge script script/RemifiVault.s.sol:RemifiVaultScript \
  --rpc-url "$CELO_RPC_URL" \
  --private-key "$AGENT_PRIVATE_KEY" \
  --broadcast \
  "$@"

echo ""
echo "After deploy, set REMIFI_VAULT_ADDRESS in Render and redeploy the agent API."
