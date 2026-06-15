"use client";

import { useEffect, useRef } from "react";
import { useActiveWalletConnectionStatus } from "thirdweb/react";
import { autoConnect, type AutoConnectProps, type Wallet } from "thirdweb/wallets";
import type { Chain } from "thirdweb/chains";
import type { ThirdwebClient } from "thirdweb";

type SafeAutoConnectProps = {
  client: ThirdwebClient;
  wallets: Wallet[];
  chain: Chain;
  appMetadata: NonNullable<AutoConnectProps["appMetadata"]>;
  timeout?: number;
};

/**
 * Restores a previous thirdweb session on revisit only — skips while the user is
 * actively connecting so it does not race with the connect modal / smart account.
 */
export function SafeAutoConnect({
  client,
  wallets,
  chain,
  appMetadata,
  timeout = 10_000,
}: SafeAutoConnectProps) {
  const status = useActiveWalletConnectionStatus();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    if (status === "connecting" || status === "connected") return;

    const timer = window.setTimeout(() => {
      if (attempted.current) return;
      attempted.current = true;

      void autoConnect({
        client,
        wallets,
        chain,
        appMetadata,
        timeout,
      }).catch(() => {
        /* no saved session */
      });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [status, client, wallets, chain, appMetadata, timeout]);

  return null;
}
