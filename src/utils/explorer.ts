import { CELO_SEPOLIA_CHAIN_ID } from "../agent/registry-addresses.js";

export function explorerBaseUrl(chainId: number): string {
  return chainId === CELO_SEPOLIA_CHAIN_ID
    ? "https://celo-sepolia.blockscout.com"
    : "https://celoscan.io";
}

export function explorerTxUrl(chainId: number, txHash: string): string {
  return `${explorerBaseUrl(chainId)}/tx/${txHash}`;
}
