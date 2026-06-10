import type { Address, Hex } from "viem";
import type { Config } from "../config/index.js";
import type { Corridor, RouteQuote } from "../types/index.js";
import {
  corridorSourceDecimals,
  createMentoClient,
} from "../mento/client.js";
import {
  getAgentAccount,
  getPublicClient,
  getTokenBalance,
  getWalletClient,
  transferToken,
} from "../wallet/client.js";

export interface OnchainResult {
  txHash: Hex;
  approvalTxHash?: Hex;
  amountOut: bigint;
  path: "direct" | "swap";
}

function sameToken(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** Unix timestamp `minutes` from now, for swap deadlines. */
function deadlineFromMinutes(minutes: number): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + minutes * 60);
}

/**
 * Execute a remittance on Celo using the agent wallet (custodial model).
 *
 * - Same source/destination token → direct ERC-20 transfer to the recipient.
 * - Different tokens              → Mento swap routed straight to the recipient.
 *
 * Returns the on-chain transaction hash(es).
 */
export async function executeRemittance(
  config: Config,
  corridor: Corridor,
  quote: RouteQuote,
  recipient: Address
): Promise<OnchainResult> {
  if (!quote.tradable) {
    throw new Error(
      `Mento pair ${corridor.mentoPair} is not tradable right now (circuit breaker or limits).`
    );
  }

  const account = getAgentAccount(config);
  const sourceToken = corridor.sourceToken as Address;
  const destinationToken = corridor.destinationToken as Address;
  const amountIn = quote.amountIn;

  // Ensure the agent wallet holds enough of the source token to send.
  const balance = await getTokenBalance(config, sourceToken, account.address);
  if (balance < amountIn) {
    const { formatUnits } = await import("viem");
    const decimals = corridorSourceDecimals(corridor);
    const tokenLabel = corridor.mentoPair.includes("USDC")
      ? "USDC"
      : corridor.sourceCurrency;
    throw new Error(
      `Insufficient agent balance for ${tokenLabel}: have ${formatUnits(balance, decimals)}, need ${formatUnits(amountIn, decimals)}.`
    );
  }

  // No FX conversion needed — send the stablecoin directly.
  if (sameToken(sourceToken, destinationToken)) {
    const txHash = await transferToken(config, sourceToken, recipient, amountIn);
    return { txHash, amountOut: amountIn, path: "direct" };
  }

  // Cross-currency: swap via Mento with the recipient as the swap output address.
  return swapToRecipient(config, sourceToken, destinationToken, amountIn, recipient);
}

/**
 * Build and execute a Mento swap, sending the output directly to `recipient`.
 *
 * The Mento SDK (viem-native) builds transaction params; the agent's viem
 * wallet client signs and broadcasts them.
 */
export async function swapToRecipient(
  config: Config,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  recipient: Address
): Promise<OnchainResult> {
  const account = getAgentAccount(config);
  const publicClient = getPublicClient(config);
  const walletClient = getWalletClient(config);
  const mento = await createMentoClient(config);

  const { approval, swap } = await mento.swap.buildSwapTransaction(
    tokenIn,
    tokenOut,
    amountIn,
    recipient,
    account.address,
    {
      slippageTolerance: config.slippageBps / 100,
      deadline: deadlineFromMinutes(10),
    }
  );

  let approvalTxHash: Hex | undefined;
  if (approval) {
    approvalTxHash = await walletClient.sendTransaction({
      to: approval.to as Address,
      data: approval.data as Hex,
      value: BigInt(approval.value ?? "0"),
    });
    await publicClient.waitForTransactionReceipt({ hash: approvalTxHash });
  }

  const txHash = await walletClient.sendTransaction({
    to: swap.params.to as Address,
    data: swap.params.data as Hex,
    value: BigInt(swap.params.value ?? "0"),
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    txHash,
    approvalTxHash,
    amountOut: swap.amountOutMin,
    path: "swap",
  };
}
