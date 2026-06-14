import { formatUnits, type Address } from "viem";
import type { Config } from "../config/index.js";
import { CELO_SEPOLIA_CHAIN_ID } from "../agent/registry-addresses.js";
import {
  CELO_SEPOLIA_USDC,
  stableTokensForChain,
} from "../mento/client.js";
import { getTokenBalance } from "../wallet/client.js";

export function primarySendToken(config: Config): string {
  return config.celoChainId === CELO_SEPOLIA_CHAIN_ID ? "USDC" : "USDm";
}

export async function primaryBalanceUsd(
  config: Config,
  walletAddress: string
): Promise<number> {
  const stables = stableTokensForChain(config.celoChainId);
  const onSepolia = config.celoChainId === CELO_SEPOLIA_CHAIN_ID;
  const token = onSepolia
    ? { symbol: "USDC", address: CELO_SEPOLIA_USDC, decimals: 6 }
    : { symbol: "USDm", address: stables.USDm, decimals: 18 };

  try {
    const raw = await getTokenBalance(
      config,
      token.address as Address,
      walletAddress as Address
    );
    return Number(formatUnits(raw, token.decimals));
  } catch {
    return 0;
  }
}
