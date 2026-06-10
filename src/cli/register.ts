#!/usr/bin/env node
import { loadConfig } from "../config/index.js";
import { getAgentAccount } from "../wallet/client.js";
import {
  buildAgentCard,
  computeAgentMetadataHash,
  resolveAgentUri,
} from "../agent/agent-card.js";
import {
  getAgentWallet,
  registerAgent,
  setAgentHash,
  setAgentUri,
} from "../agent/register.js";
import type { Config } from "../config/index.js";
import { IDENTITY_REGISTRY, isCeloSepolia } from "../agent/registry-addresses.js";

/** Public Remifi URLs used for ERC-8004 registration when env vars are unset. */
const REMIFI_WEBSITE = "https://remifi.xyz";
const REMIFI_API = "https://api.remifi.xyz";

interface Args {
  command?: string;
  uri?: string;
  dryRun: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!args.command && !a.startsWith("-")) {
      args.command = a.toLowerCase();
      continue;
    }
    if (a === "--uri" && argv[i + 1]) args.uri = argv[++i];
    else if (a === "--dry-run" || a === "-n") args.dryRun = true;
  }
  if (!args.command) args.command = "register";
  return args;
}

const CELO_SEPOLIA_CHAIN_ID = 11142220;

function scanBaseUrl(chainId: number): string {
  return chainId === CELO_SEPOLIA_CHAIN_ID
    ? "https://testnet.8004scan.io"
    : "https://8004scan.io";
}

function scanProfileUrl(chainId: number, agentId: number): string {
  if (isCeloSepolia(chainId)) {
    return `${scanBaseUrl(chainId)}/agents/celo-sepolia/${agentId}`;
  }
  return `${scanBaseUrl(chainId)}/agent/eip155:${chainId}:${IDENTITY_REGISTRY.mainnet}/${agentId}`;
}

/** Ensure registration uses live Remifi URLs, not localhost fallbacks. */
function configForRegistration(config: Config): Config {
  return {
    ...config,
    publicBaseUrl: config.publicBaseUrl ?? REMIFI_WEBSITE,
    publicAgentApiUrl: config.publicAgentApiUrl ?? REMIFI_API,
  };
}

async function main() {
  const args = parseArgs();
  const config = configForRegistration(loadConfig());

  if (!config.agentPrivateKey) {
    console.error(
      "Error: AGENT_PRIVATE_KEY is required for ERC-8004 transactions."
    );
    process.exit(1);
  }

  const account = getAgentAccount(config);
  const agentUri = args.uri ?? resolveAgentUri(config);
  const card = buildAgentCard(config, account.address);

  if (args.command === "set-hash" || args.command === "update-hash") {
    if (config.agentId == null) {
      console.error(
        "Error: AGENT_ID is required to set agentHash. Set AGENT_ID in .env"
      );
      process.exit(1);
    }

    const hash = computeAgentMetadataHash(card);
    console.log("\n--- ERC-8004 set agentHash (8004scan integrity) ---");
    console.log(`Agent ID:  ${config.agentId}`);
    console.log(`Hash:      ${hash}`);
    console.log(
      "\nEnsure hosted agent.json matches the card above before submitting."
    );

    if (args.dryRun) {
      console.log("\n(dry run — no transaction sent)");
      return;
    }

    console.log("\nSubmitting setMetadata(agentHash) transaction…");
    const { txHash, hash: onChainHash } = await setAgentHash(
      config,
      config.agentId,
      account.address
    );
    const base =
      config.celoChainId === 11142220
        ? "https://celo-sepolia.blockscout.com"
        : "https://celoscan.io";
    console.log("\n--- agentHash set ---");
    console.log(`Hash:      ${onChainHash}`);
    console.log(`Tx:        ${base}/tx/${txHash}`);
    console.log(`Profile:   ${scanProfileUrl(config.celoChainId, config.agentId)}`);
    return;
  }

  if (args.command === "update-uri" || args.command === "set-uri") {
    if (config.agentId == null) {
      console.error(
        "Error: AGENT_ID is required to update URI. Set AGENT_ID in .env"
      );
      process.exit(1);
    }
    if (agentUri.startsWith("data:")) {
      console.error(
        "Error: Set PUBLIC_AGENT_API_URL or PUBLIC_BASE_URL (or --uri) to a public HTTPS URL before update-uri."
      );
      process.exit(1);
    }

    console.log("\n--- ERC-8004 update agentURI ---");
    console.log(`Website:   ${config.publicBaseUrl}`);
    console.log(`Agent ID:  ${config.agentId}`);
    console.log(`New URI:   ${agentUri}`);
    console.log("\nAgent card (hosted file should match):");
    console.log(JSON.stringify(card, null, 2));

    if (args.dryRun) {
      console.log("\n(dry run — no transaction sent)");
      return;
    }

    console.log("\nSubmitting setAgentURI() transaction…");
    const txHash = await setAgentUri(config, config.agentId, agentUri);
    const base =
      config.celoChainId === 11142220
        ? "https://celo-sepolia.blockscout.com"
        : "https://celoscan.io";
    console.log("\n--- Updated ---");
    console.log(`Tx:        ${base}/tx/${txHash}`);
    console.log(`Profile:   ${scanProfileUrl(config.celoChainId, config.agentId)}`);
    return;
  }

  console.log("\n--- ERC-8004 registration ---");
  console.log(`Website:   ${config.publicBaseUrl}`);
  console.log(`API:       ${config.publicAgentApiUrl}`);
  console.log(`Registry:  ${config.identityRegistryAddress}`);
  console.log(`Chain:     ${config.celoChainId}`);
  console.log(`Owner:     ${account.address}`);
  console.log(`Agent URI: ${truncate(agentUri, 96)}`);
  console.log("\nAgent card:");
  console.log(JSON.stringify(card, null, 2));

  if (args.dryRun) {
    console.log("\n(dry run — no transaction sent)");
    return;
  }

  console.log("\nSubmitting register() transaction…");
  const result = await registerAgent(config, agentUri);
  const wallet = await getAgentWallet(config, result.agentId).catch(() => null);

  console.log("\n--- Registered ---");
  console.log(`Agent ID:  ${result.agentId}`);
  console.log(`Tx:        ${result.explorerUrl}`);
  console.log(`Registry:  ${result.agentRegistry}`);
  if (wallet) console.log(`Wallet:    ${wallet}`);
  console.log(`Profile:   ${scanProfileUrl(config.celoChainId, result.agentId)}`);
  console.log(
    `\nNext: add AGENT_ID=${result.agentId} to your .env, deploy your API, then run:\n` +
      `  npm run register -- update-uri`
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

main().catch((err) => {
  console.error("\nRegistration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
