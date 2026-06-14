"use client";

import { useMemo } from "react";
import { CeloChainSync } from "./CeloChainSync";
import { SafeAutoConnect } from "./SafeAutoConnect";
import { celoChain, getThirdwebClient, thirdwebConfigured } from "../lib/thirdweb";
import { remitClawAppMetadata, remitClawWallets } from "../lib/wallets";

/** Restores wallet sessions and keeps the active wallet on the configured Celo chain. */
export function WalletBootstrap() {
  const client = getThirdwebClient();
  const wallets = useMemo(() => remitClawWallets, []);

  if (!thirdwebConfigured || !client) return null;

  return (
    <>
      <SafeAutoConnect
        client={client}
        wallets={wallets}
        chain={celoChain}
        appMetadata={remitClawAppMetadata}
        timeout={10_000}
      />
      <CeloChainSync />
    </>
  );
}
