import { celoChain } from "./thirdweb";

export const CELO_MAINNET_ID = 42220;
export const CELO_SEPOLIA_ID = 11142220;

/** Native USDC on Celo (mainnet + Sepolia testnet). */
export const USDC_BY_CHAIN: Record<number, `0x${string}`> = {
  [CELO_MAINNET_ID]: "0xcebA9300b2Ee9c1d8E6B31BD10a6a979c89Af11",
  [CELO_SEPOLIA_ID]: "0x01C5C0122039549AD1493B8220cABEdD739BC44E",
};

/** Fiat on/off-ramps settle on Celo mainnet only. */
export function fiatRampEnabled(chainId: number = celoChain.id): boolean {
  return chainId === CELO_MAINNET_ID;
}

export function usdcAddress(chainId: number = celoChain.id): `0x${string}` | undefined {
  return USDC_BY_CHAIN[chainId];
}
