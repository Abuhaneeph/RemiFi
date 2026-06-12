#!/usr/bin/env bash
# Run Foundry tests. On Windows use Git Bash — PowerShell breaks forge.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

forge test "$@"
