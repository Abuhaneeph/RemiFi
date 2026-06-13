"use client";

import { useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { linkTelegramUser, markUserAuthStarted } from "../lib/api";
import { useTelegramDeepLink } from "../hooks/useTelegramDeepLink";

/** Registers the connected wallet with the agent API (and Telegram id when present). */
export function TelegramWalletLink() {
  const { telegramUserId } = useTelegramDeepLink();
  const account = useActiveAccount();

  useEffect(() => {
    if (!account?.address) return;

    void (async () => {
      try {
        if (telegramUserId) {
          await markUserAuthStarted(telegramUserId);
        }
        await linkTelegramUser({
          telegramUserId: telegramUserId ?? undefined,
          walletAddress: account.address,
        });
      } catch {
        /* best-effort */
      }
    })();
  }, [telegramUserId, account?.address]);

  return null;
}
