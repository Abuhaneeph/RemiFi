import type { Config } from "../config/index.js";
import { getPendingQuoteForUser } from "../transfers/pending-quote.js";
import { primaryBalanceUsd, primarySendToken } from "./balance.js";
import {
  authUrl,
  depositUrl,
  peopleUrl,
  telegramReturnUrl,
} from "./links.js";
import { findUserByTelegram } from "./store.js";
import type { OnboardingState, UserStatus } from "./types.js";

export async function getUserStatus(
  config: Config,
  telegramUserId: string
): Promise<UserStatus> {
  const minSendUsd = config.minSendBalanceUsd;
  const sendToken = primarySendToken(config);
  const links = {
    auth: authUrl(config, telegramUserId),
    deposit: depositUrl(config, telegramUserId),
    people: peopleUrl(config, telegramUserId),
    telegram: telegramReturnUrl(config, telegramUserId),
  };

  let user = findUserByTelegram(config, telegramUserId);
  if (!user) {
    return {
      state: "unknown",
      userId: null,
      telegramUserId,
      walletAddress: null,
      balanceUsd: 0,
      sendToken,
      minSendUsd,
      links,
    };
  }

  const pending = getPendingQuoteForUser(config, user.userId);
  if (pending) {
    return {
      state: "send_pending",
      userId: user.userId,
      telegramUserId,
      walletAddress: user.walletAddress ?? null,
      balanceUsd: user.walletAddress
        ? await primaryBalanceUsd(config, user.walletAddress)
        : 0,
      sendToken,
      minSendUsd,
      links,
      pendingConfirmUrl: pending.confirmUrl,
    };
  }

  if (!user.walletAddress) {
    const state: OnboardingState = user.authStartedAt
      ? "wallet_pending"
      : "unknown";
    return {
      state,
      userId: user.userId,
      telegramUserId,
      walletAddress: null,
      balanceUsd: 0,
      sendToken,
      minSendUsd,
      links,
    };
  }

  const balanceUsd = await primaryBalanceUsd(config, user.walletAddress);
  const state: OnboardingState =
    balanceUsd >= minSendUsd ? "funded" : "wallet_ready";

  return {
    state,
    userId: user.userId,
    telegramUserId,
    walletAddress: user.walletAddress,
    balanceUsd,
    sendToken,
    minSendUsd,
    links,
  };
}
