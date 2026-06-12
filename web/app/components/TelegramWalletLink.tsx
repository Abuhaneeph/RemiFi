"use client";

import { useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { linkTelegramUser, markUserAuthStarted } from "../lib/api";
import { useTelegramDeepLink } from "../hooks/useTelegramDeepLink";

/** Links Thirdweb wallet to Telegram user id from ?tg= deep link. */
export function TelegramWalletLink() {
  const { telegramUserId } = useTelegramDeepLink();
  const account = useActiveAccount();

  useEffect(() => {
    if (!telegramUserId || !account?.address) return;

    void (async () => {
      try {
        await markUserAuthStarted(telegramUserId);
        await linkTelegramUser({
          telegramUserId,
          walletAddress: account.address,
        });
      } catch {
        /* best-effort — user can retry from profile */
      }
    })();
  }, [telegramUserId, account?.address]);

  return null;
}
