// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {RemifiVault} from "src/RemifiVault.sol";

/// @notice Deploy RemifiVault to Celo mainnet or Sepolia.
/// @dev Use Git Bash on Windows (PowerShell breaks forge).
///
///   cd contract
///   ./scripts/deploy.sh
///
/// Env (from repo root .env or shell):
///   CELO_RPC_URL          — required
///   AGENT_PRIVATE_KEY     — deployer key (or pass --private-key)
///   CLAIM_PERIOD_SECONDS  — optional, default 2592000 (30 days)
contract RemifiVaultScript is Script {
  uint64 internal constant DEFAULT_CLAIM_PERIOD = 30 days;

  function run() public {
    uint64 claimPeriod = uint64(vm.envOr("CLAIM_PERIOD_SECONDS", uint256(DEFAULT_CLAIM_PERIOD)));

    if (claimPeriod < 1 days || claimPeriod > 90 days) {
      revert RemifiVault.InvalidClaimPeriod();
    }

    vm.startBroadcast();

    RemifiVault vault = new RemifiVault(claimPeriod);

    vm.stopBroadcast();

    console2.log("RemifiVault deployed at:", address(vault));
    console2.log("DOMAIN_SEPARATOR:", vm.toString(vault.DOMAIN_SEPARATOR()));
    console2.log("Default claim period (seconds):", vault.defaultClaimPeriod());
    console2.log("Set REMIFI_VAULT_ADDRESS on Render:", address(vault));
  }
}
