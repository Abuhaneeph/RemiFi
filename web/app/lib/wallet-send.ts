import { getContract, prepareContractCall, sendTransaction } from "thirdweb";
import type { Address } from "thirdweb";
import type { Account } from "thirdweb/wallets";
import { celoChain, getThirdwebClient } from "./thirdweb";
import { usdcAddress } from "./ramp";

const USDC_DECIMALS = 6;

function parseTokenAmount(value: string, decimals: number): bigint | null {
  const trimmed = value.trim();
  if (!trimmed || !/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) return null;
  const padded = frac.padEnd(decimals, "0");
  try {
    const units = BigInt(whole + padded);
    return units > BigInt(0) ? units : null;
  } catch {
    return null;
  }
}

/** Send native USDC from the connected wallet to an external address. */
export async function sendUsdcFromWallet(
  account: Account,
  to: Address,
  amount: string
): Promise<string> {
  const client = getThirdwebClient();
  const token = usdcAddress();
  if (!client) throw new Error("Wallet not configured.");
  if (!token) throw new Error("USDC not available on this network.");

  const units = parseTokenAmount(amount, USDC_DECIMALS);
  if (!units) throw new Error("Invalid amount.");

  const contract = getContract({
    client,
    chain: celoChain,
    address: token,
  });

  const tx = prepareContractCall({
    contract,
    method: "function transfer(address to, uint256 amount) returns (bool)",
    params: [to, units],
  });

  const result = await sendTransaction({ transaction: tx, account });
  return result.transactionHash;
}
