import { sendTransaction } from "thirdweb";
import type { Account } from "thirdweb/wallets";
import type { PrepareTransferResponse } from "./api";
import { celoChain, getThirdwebClient } from "./thirdweb";

type HexAddress = `0x${string}`;
type HexData = `0x${string}`;

export async function signPreparedTransfer(
  account: Account,
  prepared: PrepareTransferResponse
): Promise<string> {
  const client = getThirdwebClient();
  if (!client) {
    throw new Error("Thirdweb client is not configured.");
  }

  let lastHash = "";
  for (const step of prepared.transactions) {
    const result = await sendTransaction({
      account,
      transaction: {
        client,
        chain: celoChain,
        to: step.to as HexAddress,
        data: step.data as HexData,
        value: BigInt(step.value || "0"),
      },
    });
    lastHash = result.transactionHash;
  }

  if (!lastHash) {
    throw new Error("No transactions were signed.");
  }
  return lastHash;
}
