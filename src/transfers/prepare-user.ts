import {
  encodeFunctionData,
  erc20Abi,
  type Address,
  type Hex,
} from "viem";
import type { Config } from "../config/index.js";
import type { Corridor, RemittanceIntent, RouteQuote } from "../types/index.js";
import { REMIFI_VAULT_ABI } from "../escrow/abi.js";
import {
  createClaimCredentials,
  type ClaimCredentials,
} from "../escrow/client.js";
import { createMentoClient } from "../mento/client.js";

export type UnsignedTransaction = {
  to: Address;
  data: Hex;
  value: string;
  label: "approve" | "swap" | "transfer" | "vault_deposit";
};

export type PrepareUserResult = {
  transactions: UnsignedTransaction[];
  claim?: ClaimCredentials;
  deliveryMethod: "wallet" | "escrow";
};

function sameToken(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function deadlineFromMinutes(minutes: number): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + minutes * 60);
}

function asSenderAccount(address: Address) {
  return { address };
}

function txFromCall(
  label: UnsignedTransaction["label"],
  to: string,
  data: string,
  value?: string | bigint
): UnsignedTransaction {
  return {
    to: to as Address,
    data: data as Hex,
    value: String(value ?? "0"),
    label,
  };
}

async function buildSwapSteps(
  config: Config,
  sender: Address,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  recipient: Address
): Promise<UnsignedTransaction[]> {
  const mento = await createMentoClient(config);
  const { approval, swap } = await mento.swap.buildSwapTransaction(
    tokenIn,
    tokenOut,
    amountIn,
    recipient,
    sender,
    {
      slippageTolerance: config.slippageBps / 100,
      deadline: deadlineFromMinutes(10),
    }
  );

  const steps: UnsignedTransaction[] = [];
  if (approval) {
    steps.push(
      txFromCall("approve", approval.to, approval.data, approval.value)
    );
  }
  steps.push(txFromCall("swap", swap.params.to, swap.params.data, swap.params.value));
  return steps;
}

function buildTransferStep(
  token: Address,
  to: Address,
  amount: bigint
): UnsignedTransaction {
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, amount],
  });
  return txFromCall("transfer", token, data, "0");
}

function buildApproveStep(
  token: Address,
  spender: Address,
  amount: bigint
): UnsignedTransaction {
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount],
  });
  return txFromCall("approve", token, data, "0");
}

function buildVaultDepositStep(
  vault: Address,
  claimId: Hex,
  token: Address,
  amount: bigint,
  phoneHash: Hex
): UnsignedTransaction {
  const data = encodeFunctionData({
    abi: REMIFI_VAULT_ABI,
    functionName: "deposit",
    args: [claimId, token, amount, phoneHash],
  });
  return txFromCall("vault_deposit", vault, data, "0");
}

/**
 * Build unsigned transactions for a user wallet to sign in the browser.
 */
export async function prepareUserTransfer(
  config: Config,
  sender: Address,
  corridor: Corridor,
  quote: RouteQuote,
  intent: RemittanceIntent,
  delivery: "wallet" | "escrow"
): Promise<PrepareUserResult> {
  if (!quote.tradable) {
    throw new Error(
      `Mento pair ${corridor.mentoPair} is not tradable right now.`
    );
  }

  const sourceToken = corridor.sourceToken as Address;
  const destinationToken = corridor.destinationToken as Address;
  const amountIn = quote.amountIn;

  if (delivery === "wallet") {
    const recipient = intent.recipientWallet as Address;
    if (!recipient) {
      throw new Error("Recipient wallet is required for direct transfer.");
    }

    if (sameToken(sourceToken, destinationToken)) {
      return {
        deliveryMethod: "wallet",
        transactions: [buildTransferStep(sourceToken, recipient, amountIn)],
      };
    }

    return {
      deliveryMethod: "wallet",
      transactions: await buildSwapSteps(
        config,
        sender,
        sourceToken,
        destinationToken,
        amountIn,
        recipient
      ),
    };
  }

  if (!config.remifiVaultAddress) {
    throw new Error("REMIFI_VAULT_ADDRESS is not configured for escrow sends.");
  }
  if (!intent.recipientPhone) {
    throw new Error("Recipient phone is required for escrow delivery.");
  }

  const vault = config.remifiVaultAddress as Address;
  const claim = createClaimCredentials(config, intent.recipientPhone);
  const transactions: UnsignedTransaction[] = [];

  let depositToken = destinationToken;
  let depositAmount = quote.amountOut;

  if (sameToken(sourceToken, destinationToken)) {
    depositAmount = amountIn;
  } else {
    transactions.push(
      ...(await buildSwapSteps(
        config,
        sender,
        sourceToken,
        destinationToken,
        amountIn,
        sender
      ))
    );
  }

  transactions.push(
    buildApproveStep(depositToken, vault, depositAmount),
    buildVaultDepositStep(
      vault,
      claim.claimId,
      depositToken,
      depositAmount,
      claim.phoneHash
    )
  );

  return {
    deliveryMethod: "escrow",
    transactions,
    claim,
  };
}
