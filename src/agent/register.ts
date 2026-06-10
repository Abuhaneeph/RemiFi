import { type Address, type Hex, decodeEventLog } from "viem";
import type { Config } from "../config/index.js";
import {
  getAgentAccount,
  getPublicClient,
  getWalletClient,
} from "../wallet/client.js";
import {
  buildAgentCard,
  computeAgentMetadataHash,
  resolveAgentUri,
} from "./agent-card.js";

/** Minimal ERC-8004 Identity Registry ABI (the parts Remifi uses). */
export const IDENTITY_REGISTRY_ABI = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    type: "function",
    name: "setAgentURI",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "agentURI", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getAgentWallet",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "event",
    name: "Registered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: true },
    ],
  },
  {
    type: "function",
    name: "setMetadata",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "key", type: "string" },
      { name: "value", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

export interface RegisterResult {
  agentId: number;
  txHash: Hex;
  agentUri: string;
  agentRegistry: string;
  explorerUrl: string;
  scanUrl: string;
}

function celoscanBase(chainId: number): string {
  return chainId === 11142220
    ? "https://celo-sepolia.blockscout.com"
    : "https://celoscan.io";
}

/**
 * Register the Remifi agent on the ERC-8004 Identity Registry.
 *
 * Mints an agent NFT whose `agentURI` resolves to the registration file. The
 * minting wallet (the agent's `AGENT_PRIVATE_KEY`) automatically becomes both
 * the owner and the reserved `agentWallet`, so no separate `setAgentWallet`
 * proof is needed for the agent-wallet (Model A) execution model.
 */
export async function registerAgent(
  config: Config,
  agentUriOverride?: string
): Promise<RegisterResult> {
  const account = getAgentAccount(config);
  const publicClient = getPublicClient(config);
  const walletClient = getWalletClient(config);
  const registry = config.identityRegistryAddress as Address;
  const agentUri = agentUriOverride ?? resolveAgentUri(config);

  // Simulate first to surface reverts early and pre-compute the minted id.
  const { request, result } = await publicClient.simulateContract({
    account,
    address: registry,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "register",
    args: [agentUri],
  });

  const txHash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  const agentId = parseAgentId(receipt.logs, registry) ?? Number(result);

  const base = celoscanBase(config.celoChainId);
  return {
    agentId,
    txHash,
    agentUri,
    agentRegistry: `eip155:${config.celoChainId}:${registry}`,
    explorerUrl: `${base}/tx/${txHash}`,
    scanUrl: `https://8004scan.io/agent/eip155:${config.celoChainId}:${registry}/${agentId}`,
  };
}

/** Extract the minted agentId from the `Registered` event in the receipt logs. */
function parseAgentId(
  logs: { address: string; topics: readonly Hex[]; data: Hex }[],
  registry: Address
): number | undefined {
  for (const log of logs) {
    if (log.address.toLowerCase() !== registry.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: IDENTITY_REGISTRY_ABI,
        topics: log.topics as [Hex, ...Hex[]],
        data: log.data,
      });
      if (decoded.eventName === "Registered") {
        return Number((decoded.args as { agentId: bigint }).agentId);
      }
    } catch {
      // Not a Registered event from this ABI; keep scanning.
    }
  }
  return undefined;
}

/** Read the on-chain `agentWallet` (payment-receiving address) for an agent. */
export async function getAgentWallet(
  config: Config,
  agentId: number
): Promise<Address> {
  const publicClient = getPublicClient(config);
  return publicClient.readContract({
    address: config.identityRegistryAddress as Address,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "getAgentWallet",
    args: [BigInt(agentId)],
  });
}

/** Read the registered `agentURI` (tokenURI) for an agent. */
export async function getAgentUri(
  config: Config,
  agentId: number
): Promise<string> {
  const publicClient = getPublicClient(config);
  return publicClient.readContract({
    address: config.identityRegistryAddress as Address,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "tokenURI",
    args: [BigInt(agentId)],
  });
}

/** Update the `agentURI` for an already-registered agent. */
export async function setAgentUri(
  config: Config,
  agentId: number,
  agentUri: string
): Promise<Hex> {
  const account = getAgentAccount(config);
  const publicClient = getPublicClient(config);
  const walletClient = getWalletClient(config);

  const { request } = await publicClient.simulateContract({
    account,
    address: config.identityRegistryAddress as Address,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "setAgentURI",
    args: [BigInt(agentId), agentUri],
  });
  const txHash = await walletClient.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

/**
 * Set on-chain `agentHash` metadata for HTTP/HTTPS agentURI integrity (8004scan WA040).
 *
 * Computes keccak256 of the current registration file JSON.
 */
export async function setAgentHash(
  config: Config,
  agentId: number,
  walletAddress?: string | null
): Promise<{ txHash: Hex; hash: `0x${string}` }> {
  const account = getAgentAccount(config);
  const publicClient = getPublicClient(config);
  const walletClient = getWalletClient(config);
  const card = buildAgentCard(config, walletAddress ?? account.address);
  const hash = computeAgentMetadataHash(card);

  const { request } = await publicClient.simulateContract({
    account,
    address: config.identityRegistryAddress as Address,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "setMetadata",
    args: [BigInt(agentId), "agentHash", hash],
  });
  const txHash = await walletClient.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return { txHash, hash };
}
