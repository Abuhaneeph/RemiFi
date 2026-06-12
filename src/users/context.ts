import type { Config } from "../config/index.js";
import {
  findUserById,
  findUserByTelegram,
  findUserByWallet,
  touchTelegramUser,
} from "./store.js";
import { userDataDir } from "./paths.js";

export type RequestIdentity = {
  userId: string | null;
  dataDir: string;
  telegramUserId?: string;
  walletAddress?: string;
};

export type IdentityInput = {
  userId?: string;
  telegramUserId?: string;
  walletAddress?: string;
};

/** Resolve per-user data directory; falls back to global dataDir when anonymous. */
export function resolveRequestIdentity(
  config: Config,
  input?: IdentityInput
): RequestIdentity {
  const globalDir = config.dataDir;

  if (input?.userId) {
    const user = findUserById(config, input.userId);
    if (user) {
      return {
        userId: user.userId,
        dataDir: userDataDir(config, user.userId),
        telegramUserId: user.telegramUserId,
        walletAddress: user.walletAddress,
      };
    }
  }

  if (input?.walletAddress) {
    const user = findUserByWallet(config, input.walletAddress);
    if (user) {
      return {
        userId: user.userId,
        dataDir: userDataDir(config, user.userId),
        telegramUserId: user.telegramUserId,
        walletAddress: user.walletAddress,
      };
    }
  }

  if (input?.telegramUserId) {
    const user = touchTelegramUser(config, input.telegramUserId);
    return {
      userId: user.userId,
      dataDir: userDataDir(config, user.userId),
      telegramUserId: user.telegramUserId,
      walletAddress: user.walletAddress,
    };
  }

  return { userId: null, dataDir: globalDir };
}
