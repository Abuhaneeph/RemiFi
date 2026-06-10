import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  erc20Abi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Config } from "../config/index.js";

const CELO_MAINNET_ID = 42220;

/** Build a viem chain definition from config (works for Celo mainnet + Sepolia). */
export function getChain(config: Config) {
  return defineChain({
    id: config.celoChainId,
    name: config.celoChainId === CELO_MAINNET_ID ? "Celo" : "Celo Sepolia",
    nativeCurrency: { name: "Celo", symbol: "CELO", decimals: 18 },
    rpcUrls: { default: { http: [config.celoRpcUrl] } },
  });
}

export function getPublicClient(config: Config) {
  return createPublicClient({
    chain: getChain(config),
    transport: http(config.celoRpcUrl),
  });
}

/** Derive the agent's signing account from AGENT_PRIVATE_KEY. */
export function getAgentAccount(config: Config) {
  if (!config.agentPrivateKey) {
    throw new Error(
      "AGENT_PRIVATE_KEY is not set. Add it to your .env to enable on-chain execution."
    );
  }
  const raw = config.agentPrivateKey.trim();
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  return privateKeyToAccount(key);
}

export function getWalletClient(config: Config) {
  return createWalletClient({
    account: getAgentAccount(config),
    chain: getChain(config),
    transport: http(config.celoRpcUrl),
  });
}

/** Native CELO balance (raw wei) — used for gas pre-checks. */
export async function getNativeBalance(
  config: Config,
  owner: Address
): Promise<bigint> {
  const client = getPublicClient(config);
  return client.getBalance({ address: owner });
}

/** ERC-20 balance of `owner` for `token` (raw units, 18 decimals for Celo stables). */
export async function getTokenBalance(
  config: Config,
  token: Address,
  owner: Address
): Promise<bigint> {
  const client = getPublicClient(config);
  return client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
  });
}

/** Send an ERC-20 stablecoin transfer. Returns the transaction hash once mined. */
export async function transferToken(
  config: Config,
  token: Address,
  to: Address,
  amount: bigint
): Promise<Hex> {
  const wallet = getWalletClient(config);
  const publicClient = getPublicClient(config);

  const hash = await wallet.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, amount],
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/** Approve a spender to pull ERC-20 tokens from the agent wallet. */
export async function approveToken(
  config: Config,
  token: Address,
  spender: Address,
  amount: bigint
): Promise<Hex> {
  const wallet = getWalletClient(config);
  const publicClient = getPublicClient(config);

  const hash = await wallet.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount],
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
