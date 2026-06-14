import type { Config } from "../config/index.js";
import {
  linkTelegramWallet,
  markAuthStarted,
} from "../users/store.js";
import { getUserStatus } from "../users/status.js";
import {
  confirmUserTransfer,
  createTelegramConfirmQuote,
  prepareTransferForUser,
  prepareTransferFromToken,
} from "./user-transfer.js";
import type { TransferContext } from "./transfer-context.js";

export async function handleUserStatus(config: Config, telegramUserId: string) {
  return getUserStatus(config, telegramUserId);
}

export async function handleUserAuthStarted(
  config: Config,
  telegramUserId: string
) {
  const user = markAuthStarted(config, telegramUserId);
  return { ok: true, userId: user.userId, state: "wallet_pending" };
}

export async function handleUserLink(
  config: Config,
  body: { telegramUserId?: string; walletAddress: string }
) {
  if (!body.walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(body.walletAddress)) {
    throw new Error("valid walletAddress is required");
  }
  const user = linkTelegramWallet(config, body);
  return { ok: true, user };
}

export async function handleTransferPrepare(
  config: Config,
  body: Record<string, unknown>,
  ctx?: TransferContext
) {
  const message = String(body.message ?? "").trim();
  const quoteToken = body.quoteToken ? String(body.quoteToken) : undefined;
  const senderWallet = String(
    body.senderWallet ?? ctx?.senderWallet ?? ""
  ).trim();

  if (!senderWallet || !/^0x[a-fA-F0-9]{40}$/.test(senderWallet)) {
    throw new Error("senderWallet is required");
  }

  if (quoteToken) {
    return prepareTransferFromToken(config, quoteToken, senderWallet);
  }

  if (!message) {
    throw new Error("message or quoteToken is required");
  }

  return prepareTransferForUser(config, message, {
    ...ctx,
    senderWallet,
  });
}

export async function handleTransferConfirm(
  config: Config,
  body: Record<string, unknown>,
  ctx?: TransferContext
) {
  const txHash = String(body.txHash ?? "").trim();
  const receiptId = String(body.receiptId ?? "").trim();
  const senderWallet = String(
    body.senderWallet ?? ctx?.senderWallet ?? ""
  ).trim();
  const quoteToken = body.quoteToken ? String(body.quoteToken) : undefined;
  const message = body.message ? String(body.message) : undefined;

  if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    throw new Error("valid txHash is required");
  }
  if (!receiptId) throw new Error("receiptId is required");
  if (!senderWallet || !/^0x[a-fA-F0-9]{40}$/.test(senderWallet)) {
    throw new Error("senderWallet is required");
  }

  return confirmUserTransfer(config, {
    quoteToken,
    receiptId,
    txHash,
    senderWallet,
    message,
    ctx,
  });
}

export async function handleTelegramConfirm(
  config: Config,
  body: Record<string, unknown>,
  ctx?: TransferContext
) {
  const message = String(body.message ?? "").trim();
  const telegramUserId = String(
    body.telegramUserId ?? ctx?.telegramUserId ?? ""
  ).trim();
  const senderWallet = String(
    body.senderWallet ?? ctx?.senderWallet ?? ""
  ).trim();

  if (!message) throw new Error("message is required");
  if (!telegramUserId) throw new Error("telegramUserId is required");
  if (!senderWallet) throw new Error("senderWallet is required");

  return createTelegramConfirmQuote(config, message, {
    ...ctx,
    telegramUserId,
    senderWallet,
  });
}
