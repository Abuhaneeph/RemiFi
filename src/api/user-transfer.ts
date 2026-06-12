import { formatUnits, type Address, type Hex } from "viem";
import type { Config } from "../config/index.js";
import { compareFees, formatSavings } from "../fees/comparison.js";
import { findRecentDuplicate, saveTransaction } from "../history/store.js";
import { corridorDestinationDecimals } from "../mento/client.js";
import { notifyClaimLink } from "../notifications/twilio.js";
import { prepareTransfer } from "../transfers/executor.js";
import { prepareUserTransfer } from "../transfers/prepare-user.js";
import {
  consumePendingQuote,
  createPendingQuote,
  getPendingQuote,
  type PendingQuote,
} from "../transfers/pending-quote.js";
import { primaryBalanceUsd } from "../users/balance.js";
import { resolveRequestIdentity } from "../users/context.js";
import { getPublicClient } from "../wallet/client.js";
import type { TransferContext } from "./transfer-context.js";
import { type ExecuteResult, resolveIntent } from "./service.js";

export type PrepareTransferResult = {
  quoteToken?: string;
  confirmUrl?: string;
  receiptId: string;
  deliveryMethod: "wallet" | "escrow";
  recipientReceives: number;
  destinationCurrency: string;
  summary: string;
  savings: string;
  transactions: Array<{
    to: string;
    data: string;
    value: string;
    label: string;
  }>;
  claimUrl?: string;
  claimId?: string;
  claimSecret?: string;
};

function deliveryMethodFromIntent(
  intent: ReturnType<typeof resolveIntent>["intent"],
  config: Config
): "wallet" | "escrow" | "missing" {
  if (intent.recipientWallet) return "wallet";
  if (intent.recipientPhone && config.remifiVaultAddress) return "escrow";
  return "missing";
}

function pendingToPrepareResult(pending: PendingQuote): PrepareTransferResult {
  return {
    quoteToken: pending.token,
    confirmUrl: pending.confirmUrl,
    receiptId: pending.receiptId,
    deliveryMethod: pending.deliveryMethod,
    recipientReceives: pending.recipientReceives,
    destinationCurrency: pending.destinationCurrency,
    summary: pending.summary,
    savings: pending.savings,
    transactions: pending.transactions,
    claimUrl: pending.claimUrl,
    claimId: pending.claimId,
    claimSecret: pending.claimSecret,
  };
}

async function buildPreparePayload(
  config: Config,
  message: string,
  ctx: TransferContext & { senderWallet: string },
  dataDir: string,
  userId: string | null
): Promise<PrepareTransferResult> {
  const { intent } = resolveIntent(config, message, ctx, dataDir);
  const delivery = deliveryMethodFromIntent(intent, config);

  if (delivery === "missing") {
    throw new Error(
      "No recipient wallet or phone. Save a contact with a phone number or wallet address."
    );
  }

  const { corridor, quote } = await prepareTransfer(config, intent);
  const destDecimals = corridorDestinationDecimals(corridor);
  const recipientReceives = Number(formatUnits(quote.amountOut, destDecimals));
  const destLabel = corridor.mentoPair.includes("USDC")
    ? "USDC"
    : corridor.destinationCurrency;

  const balance = await primaryBalanceUsd(config, ctx.senderWallet);
  if (balance < intent.amount) {
    throw new Error(
      `Insufficient balance: have ~${balance.toFixed(2)} ${corridor.sourceCurrency}, need ${intent.amount}.`
    );
  }

  const duplicate = findRecentDuplicate(dataDir, intent);
  if (duplicate?.status === "confirmed") {
    throw new Error(
      `Duplicate ignored — identical transfer just completed (receipt ${duplicate.id}).`
    );
  }

  const comparisons = compareFees(
    `${corridor.sourceCurrency}-${corridor.destinationCountry.slice(0, 2)}`,
    intent.amount,
    quote.mentoFeeUsd,
    recipientReceives
  );
  const savings = formatSavings(comparisons);

  const prepared = await prepareUserTransfer(
    config,
    ctx.senderWallet as Address,
    corridor,
    quote,
    intent,
    delivery
  );

  const receiptId = crypto.randomUUID();
  const base: PrepareTransferResult = {
    receiptId,
    deliveryMethod: prepared.deliveryMethod,
    recipientReceives,
    destinationCurrency: destLabel,
    summary: `Send ${intent.amount} ${intent.sourceCurrency} → ~${recipientReceives.toFixed(2)} ${destLabel}`,
    savings,
    transactions: prepared.transactions,
    claimUrl: prepared.claim?.claimUrl,
    claimId: prepared.claim?.claimId,
    claimSecret: prepared.claim?.secret,
  };

  if (userId) {
    const pending = createPendingQuote(config, {
      userId,
      message,
      ctx,
      intent,
      walletAddress: ctx.senderWallet,
      receiptId,
      deliveryMethod: prepared.deliveryMethod,
      recipientReceives,
      destinationCurrency: destLabel,
      summary: base.summary,
      savings,
      transactions: prepared.transactions,
      claimUrl: prepared.claim?.claimUrl,
      claimId: prepared.claim?.claimId,
      claimSecret: prepared.claim?.secret,
    });
    base.quoteToken = pending.token;
    base.confirmUrl = pending.confirmUrl;
  }

  return base;
}

export async function prepareTransferForUser(
  config: Config,
  message: string,
  ctx: TransferContext & { senderWallet: string }
): Promise<PrepareTransferResult> {
  const identity = resolveRequestIdentity(config, {
    userId: ctx.userId,
    telegramUserId: ctx.telegramUserId,
    walletAddress: ctx.senderWallet,
  });
  return buildPreparePayload(
    config,
    message,
    ctx,
    identity.dataDir,
    identity.userId
  );
}

export async function prepareTransferFromToken(
  config: Config,
  token: string,
  senderWallet: string
): Promise<PrepareTransferResult> {
  const pending = getPendingQuote(config, token);
  if (!pending) {
    throw new Error(
      "Quote expired or not found. Request a new quote in Telegram or AI Pay."
    );
  }
  if (pending.walletAddress !== senderWallet.toLowerCase()) {
    throw new Error("Connected wallet does not match the quoted sender wallet.");
  }
  return pendingToPrepareResult(pending);
}

export async function confirmUserTransfer(
  config: Config,
  input: {
    quoteToken?: string;
    receiptId: string;
    txHash: string;
    senderWallet: string;
    message?: string;
    ctx?: TransferContext;
  }
): Promise<ExecuteResult> {
  const wallet = input.senderWallet.toLowerCase();
  let pending: PendingQuote | undefined;
  let dataDir = config.dataDir;

  if (input.quoteToken) {
    pending = consumePendingQuote(config, input.quoteToken);
    if (!pending) {
      throw new Error("Quote token expired or already used.");
    }
    if (pending.walletAddress !== wallet) {
      throw new Error("Wallet mismatch for this quote.");
    }
    const identity = resolveRequestIdentity(config, { userId: pending.userId });
    dataDir = identity.dataDir;
  } else if (input.ctx) {
    const identity = resolveRequestIdentity(config, {
      userId: input.ctx.userId,
      telegramUserId: input.ctx.telegramUserId,
      walletAddress: wallet,
    });
    dataDir = identity.dataDir;
  }

  const message = pending?.message ?? input.message;
  const ctx = pending?.ctx ?? input.ctx;
  if (!message) {
    throw new Error("message or quoteToken is required to confirm.");
  }

  const client = getPublicClient(config);
  const receipt = await client.getTransactionReceipt({
    hash: input.txHash as Hex,
  });
  if (!receipt || receipt.from.toLowerCase() !== wallet) {
    throw new Error(
      "Transaction not found or sender does not match connected wallet."
    );
  }

  const { intent } = resolveIntent(config, message, ctx, dataDir);
  const comparisons = compareFees(
    `${intent.sourceCurrency}-${intent.destinationCountry.slice(0, 2)}`,
    intent.amount,
    0,
    pending?.recipientReceives ?? 0
  );
  const savings = pending?.savings ?? formatSavings(comparisons);
  const destLabel = pending?.destinationCurrency ?? intent.sourceCurrency;
  const recipientReceives = pending?.recipientReceives ?? intent.amount;
  const deliveryMethod = pending?.deliveryMethod ?? "wallet";
  const claimUrl = pending?.claimUrl;

  let notificationSent = false;
  if (deliveryMethod === "escrow" && claimUrl && intent.recipientPhone) {
    const notification = await notifyClaimLink(
      config,
      intent,
      claimUrl,
      recipientReceives,
      intent.destinationCountry
    );
    notificationSent = Boolean(notification?.sid);
  }

  const record = {
    id: input.receiptId,
    intent,
    txHash: input.txHash as Hex,
    status: "confirmed" as const,
    createdAt: new Date().toISOString(),
    confirmedAt: new Date().toISOString(),
    feeComparison: comparisons,
    deliveryMethod,
    claimUrl,
  };
  saveTransaction(dataDir, record);

  return {
    status: "confirmed",
    receiptId: record.id,
    txHash: input.txHash,
    recipientReceives,
    destinationCurrency: destLabel,
    summary:
      deliveryMethod === "escrow"
        ? `Sent ${intent.amount} ${intent.sourceCurrency} → ~${recipientReceives.toFixed(2)} ${destLabel} (claim link)`
        : `Sent ${intent.amount} ${intent.sourceCurrency} → ~${recipientReceives.toFixed(2)} ${destLabel}`,
    savings,
    deliveryMethod,
    claimUrl,
    notificationSent,
  };
}

export async function createTelegramConfirmQuote(
  config: Config,
  message: string,
  ctx: TransferContext & { telegramUserId: string; senderWallet: string }
): Promise<{ confirmUrl: string; quoteToken: string; summary: string }> {
  const prepared = await prepareTransferForUser(config, message, ctx);
  if (!prepared.confirmUrl || !prepared.quoteToken) {
    throw new Error("Could not create confirm link for this user.");
  }
  return {
    confirmUrl: prepared.confirmUrl,
    quoteToken: prepared.quoteToken,
    summary: prepared.summary,
  };
}
